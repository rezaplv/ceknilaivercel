import { useState, useEffect, useMemo, useCallback } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuth } from "@/contexts/AuthContext";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { fetchScores, fetchKelasList, fetchMapelList } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { FileSpreadsheet, FileText, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { exportNilaiAsliToExcel, exportNilaiAsliToPDF, exportNilaiAsliToWord, type ExportNilaiAsliData } from "@/lib/exportNilaiAsli";

import { VIEW_OPTIONS_WITH_LABELS, getJenisLabel, getJenisPrefix } from "@/lib/jenisLabels";

function calcNA(avgF: number | null, avgS: number | null, sts: number | null, sas: number | null) {
  const f = avgF ?? 0;
  const s = avgS ?? 0;
  const st = (sts !== null && sts >= 0) ? sts : 0;
  const sa = (sas !== null && sas >= 0) ? sas : 0;
  const total = 2 * f + 2 * s + st + sa;
  return (total / 6).toFixed(1);
}

export default function NilaiAsli() {
  const { user } = useAuth();
  const { semester, tahunAjaran } = useAppSettings();
  usePageTitle("Nilai Asli");
  const [kelas, setKelas] = useState("");
  const [mapel, setMapel] = useState("");
  const [view, setView] = useState("ALL");
  const [allScores, setAllScores] = useState<any[]>([]);
  const [kelasList, setKelasList] = useState<{ id: string; nama: string }[]>([]);
  const [mapelList, setMapelList] = useState<{ id: string; nama: string }[]>([]);

  useEffect(() => {
    Promise.all([fetchKelasList(), fetchMapelList()]).then(([k, m]) => {
      setKelasList(k);
      setMapelList(m);
    });
  }, []);

  const loadScores = useCallback(async (kelasNama: string, mapelNama: string) => {
    const kelasObj = kelasList.find(k => k.nama === kelasNama);
    const mapelObj = mapelList.find(m => m.nama === mapelNama);
    if (!kelasObj || !mapelObj) return;
    const scores = await fetchScores({ kelas_id: kelasObj.id, mapel_id: mapelObj.id });
    const studentIds = [...new Set(scores.map((s: any) => s.student_id))];
    if (studentIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nama_lengkap")
        .in("user_id", studentIds);
      const profileMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p.nama_lengkap; });
      setAllScores(scores.map((s: any) => ({
        ...s,
        profiles: { nama_lengkap: profileMap[s.student_id] || s.student_id },
      })));
    } else {
      setAllScores(scores);
    }
  }, [kelasList, mapelList]);

  useEffect(() => {
    if (kelas && mapel) loadScores(kelas, mapel);
  }, [kelas, mapel, loadScores]);

  const showTable = kelas && mapel;

  const students = useMemo(() => {
    const map = new Map<string, string>();
    allScores.forEach((s: any) => {
      const profile = s.profiles || {};
      map.set(s.student_id, profile.nama_lengkap || s.student_id);
    });
    return Array.from(map, ([id, nama]) => ({ id, nama }))
      .sort((a, b) => a.nama.localeCompare(b.nama));
  }, [allScores]);

  const formatifNames = useMemo(
    () => [...new Set(allScores.filter((s: any) => s.jenis === "FORMATIF").map((s: any) => s.nama_penilaian))],
    [allScores]
  );
  const sumatifNames = useMemo(
    () => [...new Set(allScores.filter((s: any) => s.jenis === "SUMATIF").map((s: any) => s.nama_penilaian))],
    [allScores]
  );

  if (!user || user.role === "SISWA") return null;

  const kelasOptions = user.role === "GURU" && user.kelas?.length ? kelasList.filter(k => user.kelas!.includes(k.nama)) : kelasList;
  const mapelOptions = user.role === "GURU" && user.mapel?.length ? mapelList.filter(m => user.mapel!.includes(m.nama)) : mapelList;

  // Get the ORIGINAL value (nilai_asli if exists, otherwise nilai)
  const getOriginalNilai = (entry: any) => {
    if (!entry) return null;
    // nilai_asli stores the original input before KKM adjustment
    // If nilai_asli exists and is not null, use it (this is the raw teacher input)
    if (entry.nilai_asli !== null && entry.nilai_asli !== undefined) {
      return Number(entry.nilai_asli);
    }
    // Otherwise nilai IS the original (no KKM adjustment was applied)
    return Number(entry.nilai);
  };

  const getScore = (studentId: string, jenis: string, namaPenilaian?: string) =>
    allScores.find((s: any) => s.student_id === studentId && s.jenis === jenis && (namaPenilaian ? s.nama_penilaian === namaPenilaian : true));

  const getScoresFor = (studentId: string, jenis: string) =>
    allScores.filter((s: any) => s.student_id === studentId && s.jenis === jenis && s.nilai_type === "angka");

  const avg = (nums: number[]) => (nums.length > 0 ? nums.map(n => n < 0 ? 0 : n).reduce((a, b) => a + b, 0) / nums.length : null);

  const renderNilai = (entry: any) => {
    if (!entry) return <span className="text-muted-foreground">-</span>;
    const val = getOriginalNilai(entry);
    if (val === null || val < 0) return <span className="text-muted-foreground italic">-</span>;
    return <span>{val}</span>;
  };

  const handleExport = (type: "excel" | "pdf" | "word") => {
    const exportData: ExportNilaiAsliData = {
      kelas,
      mapel,
      guru: user.nama_lengkap || user.username || "",
      semester,
      tahunAjaran,
      students,
      allScores,
      formatifNames,
      sumatifNames,
      view: view as any,
    };
    try {
      if (type === "excel") exportNilaiAsliToExcel(exportData);
      else if (type === "pdf") exportNilaiAsliToPDF(exportData);
      else exportNilaiAsliToWord(exportData);
      toast({ title: "Berhasil", description: `File ${type.toUpperCase()} berhasil diunduh` });
    } catch (e: any) {
      toast({ title: "Gagal", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 flex items-center justify-center shadow-md shadow-orange-500/40">
              <FileSpreadsheet className="w-5 h-5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">Nilai Asli</h2>
          </div>
          <p className="text-sm text-foreground/70 mt-2.5 pl-3 border-l-[3px] border-primary font-medium">
            Nilai asli inputan guru tanpa penyesuaian KKM
          </p>
        </div>
        {showTable && students.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport("excel")} className="gap-1.5">
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} className="gap-1.5">
              <FileText className="h-4 w-4" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("word")} className="gap-1.5">
              <FileDown className="h-4 w-4" /> Word
            </Button>
          </div>
        )}
      </div>

      <div className="bg-card border rounded-xl p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Kelas</label>
            <select value={kelas} onChange={(e) => setKelas(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm">
              <option value="">Pilih Kelas</option>
              {kelasOptions.map((k) => <option key={k.id} value={k.nama}>{k.nama}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Mata Pelajaran</label>
            <select value={mapel} onChange={(e) => setMapel(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm">
              <option value="">Pilih Mapel</option>
              {mapelOptions.map((m) => <option key={m.id} value={m.nama}>{m.nama}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Tampilan</label>
            <select value={view} onChange={(e) => setView(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm">
              {VIEW_OPTIONS_WITH_LABELS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {showTable && (
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground sticky left-0 z-20 bg-muted/50 min-w-[48px]">No</th>
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground sticky left-[48px] z-20 bg-muted/50 min-w-[180px] after:content-[''] after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-border">Nama Siswa</th>
                  {(view === "ALL" || view === "FORMATIF") && formatifNames.map((name) => (
                    <th key={`fh-${name}`} className="text-center py-3 px-4 font-semibold text-muted-foreground text-xs">
                      {view === "FORMATIF" ? name : `${getJenisPrefix("FORMATIF")}: ${name}`}
                    </th>
                  ))}
                  {(view === "ALL" || view === "FORMATIF") && formatifNames.length > 1 && (
                    <th className="text-center py-3 px-4 font-semibold text-blue-600 text-xs">Rata-rata {getJenisPrefix("FORMATIF")}</th>
                  )}
                  {(view === "ALL" || view === "SUMATIF") && sumatifNames.map((name) => (
                    <th key={`sh-${name}`} className="text-center py-3 px-4 font-semibold text-muted-foreground text-xs">
                      {view === "SUMATIF" ? name : `${getJenisPrefix("SUMATIF")}: ${name}`}
                    </th>
                  ))}
                  {(view === "ALL" || view === "SUMATIF") && sumatifNames.length >= 1 && (
                    <th className="text-center py-3 px-4 font-semibold text-blue-600 text-xs">Rata-rata {getJenisPrefix("SUMATIF")}</th>
                  )}
                  {(view === "ALL" || view === "STS") && <th className="text-center py-3 px-4 font-semibold text-muted-foreground">STS</th>}
                  {(view === "ALL" || view === "SAS") && <th className="text-center py-3 px-4 font-semibold text-muted-foreground">SAS</th>}
                  {view === "ALL" && <th className="text-center py-3 px-4 font-semibold text-primary">Nilai Akhir</th>}
                </tr>
              </thead>
              <tbody>
                {students.map((st, i) => {
                  // Use original values for all calculations
                  const fScores = getScoresFor(st.id, "FORMATIF");
                  const sScores = getScoresFor(st.id, "SUMATIF");
                  const fOriginalVals = fScores.map((s: any) => getOriginalNilai(s)!);
                  const sOriginalVals = sScores.map((s: any) => getOriginalNilai(s)!);
                  const avgF = avg(fOriginalVals);
                  const avgS = avg(sOriginalVals);
                  const stsEntry = getScore(st.id, "STS");
                  const sasEntry = getScore(st.id, "SAS");
                  const stsVal = stsEntry ? getOriginalNilai(stsEntry) : null;
                  const sasVal = sasEntry ? getOriginalNilai(sasEntry) : null;
                  const na = calcNA(avgF, avgS, stsVal, sasVal);

                  return (
                    <tr key={st.id} className="border-t hover:bg-muted/30 transition-colors group">
                      <td className="py-3 px-4 text-muted-foreground sticky left-0 z-10 bg-card group-hover:bg-muted/30 transition-colors">{i + 1}</td>
                      <td className="py-3 px-4 font-medium sticky left-[48px] z-10 bg-card group-hover:bg-muted/30 transition-colors after:content-[''] after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-border">{st.nama}</td>
                      {(view === "ALL" || view === "FORMATIF") && formatifNames.map((name) => (
                        <td key={`f-${st.id}-${name}`} className="py-3 px-4 text-center">{renderNilai(getScore(st.id, "FORMATIF", name))}</td>
                      ))}
                      {(view === "ALL" || view === "FORMATIF") && formatifNames.length > 1 && (
                        <td className="py-3 px-4 text-center font-semibold text-blue-600">{avgF !== null ? avgF.toFixed(1) : "-"}</td>
                      )}
                      {(view === "ALL" || view === "SUMATIF") && sumatifNames.map((name) => (
                        <td key={`s-${st.id}-${name}`} className="py-3 px-4 text-center">{renderNilai(getScore(st.id, "SUMATIF", name))}</td>
                      ))}
                      {(view === "ALL" || view === "SUMATIF") && sumatifNames.length >= 1 && (
                        <td className="py-3 px-4 text-center font-semibold text-blue-600">{avgS !== null ? avgS.toFixed(1) : "-"}</td>
                      )}
                      {(view === "ALL" || view === "STS") && <td className="py-3 px-4 text-center">{renderNilai(stsEntry)}</td>}
                      {(view === "ALL" || view === "SAS") && <td className="py-3 px-4 text-center">{renderNilai(sasEntry)}</td>}
                      {view === "ALL" && <td className="py-3 px-4 text-center font-bold text-primary">{na ?? "-"}</td>}
                    </tr>
                  );
                })}
                {students.length === 0 && (
                  <tr><td colSpan={20} className="py-8 text-center text-muted-foreground">Belum ada data nilai untuk kelas dan mapel ini</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
