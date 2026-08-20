import { useState, useEffect, useMemo, useCallback } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuth } from "@/contexts/AuthContext";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { fetchScores, fetchKelasList, fetchMapelList, fetchStudentsByKelas } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, ClipboardList, CheckCircle2, Loader2, FileSpreadsheet, FileText, FileDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { exportTagihanToExcel, exportTagihanToPDF, exportTagihanToWord, type TagihanExportData } from "@/lib/exportTagihan";

type Jenis = "FORMATIF" | "SUMATIF" | "STS" | "SAS";

interface MissingRow {
  user_id: string;
  nama: string;
  missing: Record<Jenis, string[]>; // list of nama_penilaian missing per jenis
  total: number;
}

const JENIS_LIST: Jenis[] = ["FORMATIF", "SUMATIF", "STS", "SAS"];

const JENIS_COLOR: Record<Jenis, string> = {
  FORMATIF: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  SUMATIF: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30",
  STS: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  SAS: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
};

export default function Tagihan() {
  usePageTitle("Tagihan Nilai");
  const { user } = useAuth();
  const { semester, tahunAjaran } = useAppSettings();
  const [kelas, setKelas] = useState("");
  const [mapel, setMapel] = useState("");
  const [kelasList, setKelasList] = useState<{ id: string; nama: string }[]>([]);
  const [mapelList, setMapelList] = useState<{ id: string; nama: string }[]>([]);
  const [students, setStudents] = useState<{ user_id: string; nama_lengkap: string }[]>([]);
  const [allScores, setAllScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([fetchKelasList(), fetchMapelList()]).then(([k, m]) => {
      setKelasList(k);
      setMapelList(m);
    });
  }, []);

  const load = useCallback(async () => {
    if (!kelas || !mapel) return;
    const kelasObj = kelasList.find((k) => k.nama === kelas);
    const mapelObj = mapelList.find((m) => m.nama === mapel);
    if (!kelasObj || !mapelObj) return;
    setLoading(true);
    try {
      const [scores, siswa] = await Promise.all([
        fetchScores({ kelas_id: kelasObj.id, mapel_id: mapelObj.id }),
        fetchStudentsByKelas(kelas),
      ]);
      setAllScores(scores);
      setStudents(siswa.map((s: any) => ({ user_id: s.user_id, nama_lengkap: s.nama_lengkap })));
    } finally {
      setLoading(false);
    }
  }, [kelas, mapel, kelasList, mapelList]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: refresh ketika ada perubahan nilai (insert/update/delete) untuk kelas+mapel ini
  useEffect(() => {
    if (!kelas || !mapel) return;
    const kelasObj = kelasList.find((k) => k.nama === kelas);
    const mapelObj = mapelList.find((m) => m.nama === mapel);
    if (!kelasObj || !mapelObj) return;

    const channel = supabase
      .channel(`tagihan-${kelasObj.id}-${mapelObj.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scores", filter: `kelas_id=eq.${kelasObj.id}` },
        (payload: any) => {
          const row = payload.new ?? payload.old;
          if (row?.mapel_id === mapelObj.id) load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [kelas, mapel, kelasList, mapelList, load]);

  // Penilaian names that exist in this class for FORMATIF / SUMATIF
  const penilaianNames = useMemo(() => {
    const f = [...new Set(allScores.filter((s: any) => s.jenis === "FORMATIF").map((s: any) => s.nama_penilaian))];
    const s = [...new Set(allScores.filter((s: any) => s.jenis === "SUMATIF").map((s: any) => s.nama_penilaian))];
    const hasSTS = allScores.some((s: any) => s.jenis === "STS");
    const hasSAS = allScores.some((s: any) => s.jenis === "SAS");
    return { FORMATIF: f as string[], SUMATIF: s as string[], STS: hasSTS, SAS: hasSAS };
  }, [allScores]);

  const isFilled = (entry: any) => {
    if (!entry) return false;
    if (entry.nilai_type === "ceklis") return true; // any ceklis row counts as filled
    return Number(entry.nilai) >= 0;
  };

  const rows: MissingRow[] = useMemo(() => {
    const result: MissingRow[] = [];
    for (const st of students) {
      const missing: Record<Jenis, string[]> = { FORMATIF: [], SUMATIF: [], STS: [], SAS: [] };

      // FORMATIF + SUMATIF: cek setiap nama_penilaian yang ada di kelas
      for (const jenis of ["FORMATIF", "SUMATIF"] as const) {
        for (const nama of penilaianNames[jenis]) {
          const entry = allScores.find(
            (s: any) => s.student_id === st.user_id && s.jenis === jenis && s.nama_penilaian === nama
          );
          if (!isFilled(entry)) missing[jenis].push(nama);
        }
      }

      // STS / SAS: single penilaian per mapel
      if (penilaianNames.STS) {
        const e = allScores.find((s: any) => s.student_id === st.user_id && s.jenis === "STS");
        if (!isFilled(e)) missing.STS.push("STS");
      }
      if (penilaianNames.SAS) {
        const e = allScores.find((s: any) => s.student_id === st.user_id && s.jenis === "SAS");
        if (!isFilled(e)) missing.SAS.push("SAS");
      }

      const total = missing.FORMATIF.length + missing.SUMATIF.length + missing.STS.length + missing.SAS.length;
      if (total > 0) result.push({ user_id: st.user_id, nama: st.nama_lengkap, missing, total });
    }
    return result.sort((a, b) => b.total - a.total || a.nama.localeCompare(b.nama));
  }, [students, allScores, penilaianNames]);

  if (!user || user.role === "SISWA") return null;

  const kelasOptions = user.role === "GURU" && user.kelas?.length ? kelasList.filter((k) => user.kelas!.includes(k.nama)) : kelasList;
  const mapelOptions = user.role === "GURU" && user.mapel?.length ? mapelList.filter((m) => user.mapel!.includes(m.nama)) : mapelList;

  const showResult = kelas && mapel;
  const hasAnyPenilaian =
    penilaianNames.FORMATIF.length > 0 || penilaianNames.SUMATIF.length > 0 || penilaianNames.STS || penilaianNames.SAS;

  const handleExport = async (type: "excel" | "pdf" | "word") => {
    if (rows.length === 0) {
      toast({ title: "Tidak ada data", description: "Belum ada tagihan untuk diekspor." });
      return;
    }
    const data: TagihanExportData = {
      kelas,
      mapel,
      guru: user.nama_lengkap || user.username || "",
      semester,
      tahunAjaran,
      totalSiswa: students.length,
      rows: rows.map((r) => ({ nama: r.nama, missing: r.missing, total: r.total })),
    };
    try {
      if (type === "excel") exportTagihanToExcel(data);
      else if (type === "pdf") exportTagihanToPDF(data);
      else await exportTagihanToWord(data);
      toast({ title: "Berhasil", description: `File ${type.toUpperCase()} berhasil diunduh` });
    } catch (e: any) {
      toast({ title: "Gagal", description: e.message, variant: "destructive" });
    }
  };

  const canExport = showResult && rows.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 via-red-500 to-orange-500 flex items-center justify-center shadow-md shadow-rose-500/40 shrink-0">
              <ClipboardList className="w-5 h-5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">Tagihan Nilai</h2>
          </div>
          <p className="text-sm text-foreground/70 mt-2.5 pl-3 border-l-[3px] border-primary font-medium">
            Daftar siswa yang nilainya masih kosong — Formatif, Sumatif, STS, dan SAS (data dari Rekap Nilai)
          </p>
        </div>
        {canExport && (
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" onClick={() => handleExport("excel")} className="gap-1.5 flex-1 sm:flex-initial">
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} className="gap-1.5 flex-1 sm:flex-initial">
              <FileText className="h-4 w-4" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("word")} className="gap-1.5 flex-1 sm:flex-initial">
              <FileDown className="h-4 w-4" /> Word
            </Button>
          </div>
        )}
      </div>

      {/* Filter */}
      <div className="bg-card border rounded-xl p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Kelas</label>
            <select value={kelas} onChange={(e) => setKelas(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm">
              <option value="">Pilih Kelas</option>
              {kelasOptions.map((k) => (
                <option key={k.id} value={k.nama}>{k.nama}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Mata Pelajaran</label>
            <select value={mapel} onChange={(e) => setMapel(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm">
              <option value="">Pilih Mapel</option>
              {mapelOptions.map((m) => (
                <option key={m.id} value={m.nama}>{m.nama}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Result */}
      {showResult && (
        <>
          {loading ? (
            <div className="bg-card border rounded-xl p-10 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
              <p className="text-sm">Memuat data tagihan...</p>
            </div>
          ) : students.length === 0 ? (
            <div className="bg-card border rounded-xl p-10 text-center text-muted-foreground text-sm">
              Belum ada siswa di kelas ini.
            </div>
          ) : !hasAnyPenilaian ? (
            <div className="bg-card border rounded-xl p-10 text-center text-muted-foreground text-sm">
              Belum ada penilaian yang dibuat untuk mapel ini.
            </div>
          ) : rows.length === 0 ? (
            <div className="bg-card border rounded-xl p-10 flex flex-col items-center justify-center gap-3 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-10 h-10" />
              <p className="text-sm font-semibold">Lunas! Semua siswa sudah memiliki nilai lengkap.</p>
            </div>
          ) : (
            <>
              {/* Summary chips */}
              <div className="bg-card border rounded-xl p-4 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500" />
                  <span className="text-sm font-semibold">
                    {rows.length} siswa memiliki tagihan
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  dari {students.length} siswa di kelas
                </span>
              </div>

              {/* Desktop table */}
              <div className="hidden md:block bg-card border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="text-left py-3 px-4 font-semibold text-muted-foreground w-12">No</th>
                        <th className="text-left py-3 px-4 font-semibold text-muted-foreground min-w-[180px]">Nama Siswa</th>
                        {JENIS_LIST.map((j) => (
                          <th key={j} className="text-left py-3 px-4 font-semibold text-muted-foreground min-w-[160px]">
                            {j}
                          </th>
                        ))}
                        <th className="text-center py-3 px-4 font-semibold text-muted-foreground w-20">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, idx) => (
                        <tr key={r.user_id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4 text-muted-foreground">{idx + 1}</td>
                          <td className="py-3 px-4 font-medium">{r.nama}</td>
                          {JENIS_LIST.map((j) => (
                            <td key={j} className="py-3 px-4 align-top">
                              {r.missing[j].length === 0 ? (
                                <span className="text-emerald-600 dark:text-emerald-400 text-xs inline-flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Lengkap
                                </span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {r.missing[j].map((n) => (
                                    <Badge key={n} variant="outline" className={`text-[11px] font-normal ${JENIS_COLOR[j]}`}>
                                      {n}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </td>
                          ))}
                          <td className="py-3 px-4 text-center">
                            <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/30 font-semibold">
                              {r.total}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {rows.map((r, idx) => (
                  <div key={r.user_id} className="bg-card border rounded-xl p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">#{idx + 1}</p>
                        <h3 className="font-semibold text-sm break-words">{r.nama}</h3>
                      </div>
                      <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/30 font-semibold shrink-0">
                        {r.total} tagihan
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {JENIS_LIST.map((j) =>
                        r.missing[j].length === 0 ? null : (
                          <div key={j}>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                              {j}
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {r.missing[j].map((n) => (
                                <Badge key={n} variant="outline" className={`text-[11px] font-normal ${JENIS_COLOR[j]}`}>
                                  {n}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
