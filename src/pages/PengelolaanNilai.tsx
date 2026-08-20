import { useState, useEffect, useMemo, useCallback } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuth } from "@/contexts/AuthContext";
import { fetchScores, fetchKelasList, fetchMapelList } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { Filter, Save, Sparkles, Pencil, Check, X, FileSpreadsheet, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// === Kriteria filter + nilai final otomatis ===
const KRITERIA = [
  { label: "100", min: 100, max: 100, finalValue: 100, color: "bg-emerald-500/15 text-emerald-700 border-emerald-300" },
  { label: "99", min: 99, max: 99, finalValue: 100, color: "bg-emerald-500/15 text-emerald-700 border-emerald-300" },
  { label: "98", min: 98, max: 98, finalValue: 100, color: "bg-emerald-500/15 text-emerald-700 border-emerald-300" },
  { label: "97", min: 97, max: 97, finalValue: 99, color: "bg-green-500/15 text-green-700 border-green-300" },
  { label: "96", min: 96, max: 96, finalValue: 98, color: "bg-green-500/15 text-green-700 border-green-300" },
  { label: "95", min: 95, max: 95, finalValue: 97, color: "bg-lime-500/15 text-lime-700 border-lime-300" },
  { label: "94", min: 94, max: 94, finalValue: 96, color: "bg-lime-500/15 text-lime-700 border-lime-300" },
  { label: "93", min: 93, max: 93, finalValue: 95, color: "bg-teal-500/15 text-teal-700 border-teal-300" },
  { label: "92", min: 92, max: 92, finalValue: 94, color: "bg-teal-500/15 text-teal-700 border-teal-300" },
  { label: "91", min: 91, max: 91, finalValue: 93, color: "bg-cyan-500/15 text-cyan-700 border-cyan-300" },
  { label: "90", min: 90, max: 90, finalValue: 92, color: "bg-cyan-500/15 text-cyan-700 border-cyan-300" },
  { label: "89", min: 89, max: 89, finalValue: 91, color: "bg-sky-500/15 text-sky-700 border-sky-300" },
  { label: "88", min: 88, max: 88, finalValue: 90, color: "bg-sky-500/15 text-sky-700 border-sky-300" },
  { label: "87", min: 87, max: 87, finalValue: 89, color: "bg-blue-500/15 text-blue-700 border-blue-300" },
  { label: "86", min: 86, max: 86, finalValue: 88, color: "bg-blue-500/15 text-blue-700 border-blue-300" },
  { label: "85", min: 85, max: 85, finalValue: 87, color: "bg-indigo-500/15 text-indigo-700 border-indigo-300" },
  { label: "84", min: 84, max: 84, finalValue: 86, color: "bg-indigo-500/15 text-indigo-700 border-indigo-300" },
  { label: "83", min: 83, max: 83, finalValue: 85, color: "bg-violet-500/15 text-violet-700 border-violet-300" },
  { label: "82", min: 82, max: 82, finalValue: 84, color: "bg-violet-500/15 text-violet-700 border-violet-300" },
  { label: "81", min: 81, max: 81, finalValue: 83, color: "bg-purple-500/15 text-purple-700 border-purple-300" },
  { label: "80", min: 80, max: 80, finalValue: 82, color: "bg-purple-500/15 text-purple-700 border-purple-300" },
  { label: "79", min: 79, max: 79, finalValue: 81, color: "bg-fuchsia-500/15 text-fuchsia-700 border-fuchsia-300" },
  { label: "78", min: 78, max: 78, finalValue: 80, color: "bg-fuchsia-500/15 text-fuchsia-700 border-fuchsia-300" },
  { label: "77", min: 77, max: 77, finalValue: 79, color: "bg-pink-500/15 text-pink-700 border-pink-300" },
  { label: "76", min: 76, max: 76, finalValue: 78, color: "bg-pink-500/15 text-pink-700 border-pink-300" },
  { label: "75", min: 75, max: 75, finalValue: 77, color: "bg-rose-500/15 text-rose-700 border-rose-300" },
  { label: "0 – 74", min: 0, max: 74, finalValue: 75, color: "bg-rose-600/15 text-rose-700 border-rose-300" },
];

function getKriteria(na: number) {
  return KRITERIA.find((k) => na >= k.min && na <= k.max) || null;
}

function calcNAOriginal(scores: any[], studentId: string) {
  // Harus identik dengan perhitungan NA di Rekap Nilai:
  // gunakan kolom `nilai` (yang sudah disesuaikan KKM), bukan `nilai_asli`.
  const get = (jenis: string) =>
    scores.filter(
      (s) => s.student_id === studentId && s.jenis === jenis && s.nilai_type === "angka"
    );
  const val = (s: any) => Number(s.nilai);
  const avg = (arr: number[]) =>
    arr.length ? arr.map((n) => (n < 0 ? 0 : n)).reduce((a, b) => a + b, 0) / arr.length : 0;

  const f = avg(get("FORMATIF").map(val));
  const s = avg(get("SUMATIF").map(val));
  const stsE = get("STS")[0];
  const sasE = get("SAS")[0];
  const stsV = stsE ? val(stsE) : null;
  const sasV = sasE ? val(sasE) : null;
  const st = stsV !== null && stsV >= 0 ? stsV : 0;
  const sa = sasV !== null && sasV >= 0 ? sasV : 0;
  // Pembulatan ke bilangan bulat (75.5 -> 76, 75.4 -> 75) agar selalu masuk kriteria
  return Math.round((2 * f + 2 * s + st + sa) / 6);
}

function getJenisNilai(scores: any[], studentId: string, jenis: "STS" | "SAS"): number | null {
  const e = scores.find(
    (s) => s.student_id === studentId && s.jenis === jenis && s.nilai_type === "angka"
  );
  if (!e) return null;
  const v = e.nilai_asli !== null && e.nilai_asli !== undefined ? Number(e.nilai_asli) : Number(e.nilai);
  if (isNaN(v) || v < 0) return null;
  return Math.round(v);
}
const getSAS = (scores: any[], studentId: string) => getJenisNilai(scores, studentId, "SAS");
const getSTS = (scores: any[], studentId: string) => getJenisNilai(scores, studentId, "STS");

function getAvgSumatif(scores: any[], studentId: string): number | null {
  const arr = scores.filter(
    (s) => s.student_id === studentId && s.jenis === "SUMATIF" && s.nilai_type === "angka"
  );
  if (arr.length === 0) return null;
  const nums = arr.map((s) => {
    const v = Number(s.nilai);
    return v < 0 ? 0 : v;
  });
  return nums.reduce((a, b) => a + b, 0) / arr.length;
}

function countFormatifBelum(scores: any[], studentId: string): number {
  return scores.filter((s) => {
    if (s.student_id !== studentId || s.jenis !== "FORMATIF" || s.nilai_type !== "angka") return false;
    const v = s.nilai_asli !== null && s.nilai_asli !== undefined ? Number(s.nilai_asli) : Number(s.nilai);
    return isNaN(v) || v < 0;
  }).length;
}

interface Row {
  studentId: string;
  nama: string;
  nilaiAsli: number;
  rataRataSumatif: number | null;
  nilaiSTS: number | null;
  nilaiSAS: number | null;
  formatifBelum: number;
  kriteria: string;
  nilaiFinal: number;
  existing?: boolean;
}

export default function PengelolaanNilai() {
  const { user } = useAuth();
  usePageTitle("Pengelolaan Nilai");
  const [kelas, setKelas] = useState<string>(() => sessionStorage.getItem("pn_kelas") || "");
  const [mapel, setMapel] = useState<string>(() => sessionStorage.getItem("pn_mapel") || "");
  const [filterIdx, setFilterIdx] = useState<number | null>(() => {
    const v = sessionStorage.getItem("pn_filterIdx");
    return v === null || v === "" ? null : Number(v);
  });
  const [allScores, setAllScores] = useState<any[]>([]);
  const [kelasList, setKelasList] = useState<{ id: string; nama: string }[]>([]);
  const [mapelList, setMapelList] = useState<{ id: string; nama: string }[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});
  const [pengelolaan, setPengelolaan] = useState<Record<string, any>>({});
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [bulkValue, setBulkValue] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [showResults, setShowResults] = useState<boolean>(
    () => sessionStorage.getItem("pn_showResults") === "1"
  );

  // Persist UI state across navigation
  useEffect(() => { sessionStorage.setItem("pn_kelas", kelas); }, [kelas]);
  useEffect(() => { sessionStorage.setItem("pn_mapel", mapel); }, [mapel]);
  useEffect(() => {
    sessionStorage.setItem("pn_filterIdx", filterIdx === null ? "" : String(filterIdx));
  }, [filterIdx]);
  useEffect(() => {
    sessionStorage.setItem("pn_showResults", showResults ? "1" : "0");
  }, [showResults]);

  useEffect(() => {
    Promise.all([fetchKelasList(), fetchMapelList()]).then(([k, m]) => {
      setKelasList(k);
      setMapelList(m);
    });
  }, []);

  const loadData = useCallback(
    async (kelasNama: string, mapelNama: string) => {
      const kelasObj = kelasList.find((k) => k.nama === kelasNama);
      const mapelObj = mapelList.find((m) => m.nama === mapelNama);
      if (!kelasObj || !mapelObj) return;

      const scores = await fetchScores({ kelas_id: kelasObj.id, mapel_id: mapelObj.id });
      setAllScores(scores);

      const studentIds = [...new Set(scores.map((s: any) => s.student_id))];
      if (studentIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, nama_lengkap")
          .in("user_id", studentIds);
        const pm: Record<string, string> = {};
        (profiles || []).forEach((p: any) => (pm[p.user_id] = p.nama_lengkap));
        setProfileMap(pm);
      }

      const { data: existing } = await (supabase as any)
        .from("nilai_pengelolaan")
        .select("*")
        .eq("kelas_id", kelasObj.id)
        .eq("mapel_id", mapelObj.id);
      const map: Record<string, any> = {};
      const ov: Record<string, number> = {};
      (existing || []).forEach((p: any) => {
        map[p.student_id] = p;
        ov[p.student_id] = Number(p.nilai_final);
      });
      setPengelolaan(map);
      setOverrides(ov);
    },
    [kelasList, mapelList]
  );

  useEffect(() => {
    if (kelas && mapel) {
      loadData(kelas, mapel);
    }
  }, [kelas, mapel, loadData]);

  if (!user || user.role === "SISWA") return null;

  const kelasOptions =
    user.role === "GURU" && user.kelas?.length
      ? kelasList.filter((k) => user.kelas!.includes(k.nama))
      : kelasList;
  const mapelOptions =
    user.role === "GURU" && user.mapel?.length
      ? mapelList.filter((m) => user.mapel!.includes(m.nama))
      : mapelList;

  const studentIds = useMemo(
    () => [...new Set(allScores.map((s: any) => s.student_id))],
    [allScores]
  );

  const allRows: Row[] = useMemo(() => {
    return studentIds
      .map((id) => {
        const nilaiAsli = calcNAOriginal(allScores, id);
        const rataRataSumatif = getAvgSumatif(allScores, id);
        const nilaiSTS = getSTS(allScores, id);
        const nilaiSAS = getSAS(allScores, id);
        const formatifBelum = countFormatifBelum(allScores, id);
        const k = getKriteria(nilaiAsli);
        const existing = pengelolaan[id];
        const defaultFinal = k?.finalValue ?? nilaiAsli;
        const finalVal = overrides[id] !== undefined ? overrides[id] : defaultFinal;
        return {
          studentId: id,
          nama: profileMap[id] || id,
          nilaiAsli,
          rataRataSumatif,
          nilaiSTS,
          nilaiSAS,
          formatifBelum,
          kriteria: k?.label || "-",
          nilaiFinal: finalVal,
          existing: !!existing,
        };
      })
      .sort((a, b) => a.nama.localeCompare(b.nama));
  }, [studentIds, allScores, profileMap, pengelolaan, overrides]);

  const filteredRows = useMemo(() => {
    if (filterIdx === null) return allRows;
    const k = KRITERIA[filterIdx];
    return allRows.filter((r) => r.nilaiAsli >= k.min && r.nilaiAsli <= k.max);
  }, [allRows, filterIdx]);

  const handleAutoFilter = (idx: number) => {
    setFilterIdx(idx);
    setShowResults(true);
  };

  const handleShowAll = () => {
    setFilterIdx(null);
    setShowResults(true);
  };

  const handleBulkApply = () => {
    const n = parseFloat(bulkValue);
    if (isNaN(n)) {
      toast({ title: "Info", description: "Masukkan angka tambahan terlebih dahulu (mis. 10)", variant: "destructive" });
      return;
    }
    const add = Math.round(n);
    const next = { ...overrides };
    filteredRows.forEach((r) => {
      const base = r.nilaiFinal;
      next[r.studentId] = Math.min(100, Math.max(0, base + add));
    });
    setOverrides(next);
    toast({ title: "Berhasil", description: `+${add} ditambahkan ke Nilai Final ${filteredRows.length} siswa. Klik "Simpan Pengelolaan" untuk menyimpan.` });
  };

  const handleBulkReset = () => {
    const next = { ...overrides };
    filteredRows.forEach((r) => { delete next[r.studentId]; });
    setOverrides(next);
    setBulkValue("");
    toast({ title: "Direset", description: "Nilai Final dikembalikan ke nilai otomatis sesuai kriteria." });
  };


  const handleSaveAll = async () => {
    const kelasObj = kelasList.find((k) => k.nama === kelas);
    const mapelObj = mapelList.find((m) => m.nama === mapel);
    if (!kelasObj || !mapelObj) return;

    const rows = filteredRows
      .map((r) => {
        const k = getKriteria(r.nilaiAsli);
        const nilaiFinal = r.nilaiFinal;
        const tambahan = nilaiFinal - r.nilaiAsli;
        return {
          student_id: r.studentId,
          kelas_id: kelasObj.id,
          mapel_id: mapelObj.id,
          nilai_asli: r.nilaiAsli,
          nilai_tambahan: tambahan,
          nilai_final: nilaiFinal,
          kriteria: k?.label || null,
          created_by: user.user_id,
        };
      });

    if (rows.length === 0) {
      toast({ title: "Info", description: "Tidak ada data untuk disimpan" });
      return;
    }

    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("nilai_pengelolaan")
        .upsert(rows, { onConflict: "student_id,kelas_id,mapel_id" });
      if (error) throw error;
      toast({ title: "Berhasil", description: `${rows.length} nilai pengelolaan disimpan` });
      loadData(kelas, mapel);
    } catch (e: any) {
      toast({ title: "Gagal", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleExportExcel = () => {
    if (filteredRows.length === 0) {
      toast({ title: "Info", description: "Tidak ada data untuk diekspor" });
      return;
    }
    const title = filterIdx !== null ? `KRITERIA ${KRITERIA[filterIdx].label}` : "SEMUA SISWA";
    const aoa: any[][] = [];
    aoa.push(["DAFTAR PENGELOLAAN NILAI"]);
    aoa.push([title]);
    aoa.push([]);
    aoa.push(["KELAS", `: ${kelas}`, "", "MATA PELAJARAN", `: ${mapel}`]);
    aoa.push(["GURU", `: ${user.nama_lengkap || user.username || "-"}`]);
    aoa.push([]);
    aoa.push(["NO", "NAMA SISWA", "NILAI AKHIR ASLI", "RATA-RATA SUMATIF", "NILAI STS", "NILAI SAS", "TAGIHAN TUGAS", "KRITERIA", "NILAI FINAL"]);
    filteredRows.forEach((r, i) => {
      aoa.push([i + 1, r.nama, r.nilaiAsli, r.rataRataSumatif !== null ? r.rataRataSumatif.toFixed(1) : "-", r.nilaiSTS ?? "-", r.nilaiSAS ?? "-", r.formatifBelum, r.kriteria, r.nilaiFinal]);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
    ];
    ws["!cols"] = [
      { wch: 5 },
      { wch: 35 },
      { wch: 18 },
      { wch: 18 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
    ];

    // Basic styling via cell properties (alignment)
    const range = XLSX.utils.decode_range(ws["!ref"] as string);
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[addr];
        if (!cell) continue;
        cell.s = cell.s || {};
        if (R === 0) {
          cell.s = { font: { bold: true, sz: 14 }, alignment: { horizontal: "center", vertical: "center" } };
        } else if (R === 1) {
          cell.s = { font: { bold: true, sz: 11 }, alignment: { horizontal: "center" } };
        } else if (R === 6) {
          cell.s = { font: { bold: true }, alignment: { horizontal: "center", vertical: "center", wrapText: true } };
        } else if (R >= 7) {
          cell.s = { alignment: { horizontal: C === 1 ? "left" : "center", vertical: "center" } };
        }
      }
    }
    ws["!rows"] = [{ hpt: 22 }, { hpt: 18 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pengelolaan Nilai");
    const safeKelas = (kelas || "kelas").replace(/[^\w-]+/g, "_");
    const safeMapel = (mapel || "mapel").replace(/[^\w-]+/g, "_");
    XLSX.writeFile(wb, `Pengelolaan_Nilai_${safeKelas}_${safeMapel}.xlsx`);
    toast({ title: "Berhasil", description: "File Excel berhasil diunduh" });
  };

  const handleExportPDF = () => {
    if (filteredRows.length === 0) {
      toast({ title: "Info", description: "Tidak ada data untuk diekspor" });
      return;
    }
    const title = filterIdx !== null ? `KRITERIA ${KRITERIA[filterIdx].label}` : "SEMUA SISWA";
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("DAFTAR PENGELOLAAN NILAI", pageW / 2, 15, { align: "center" });
    doc.setFontSize(11);
    doc.text(title, pageW / 2, 22, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Kelas           : ${kelas}`, 14, 32);
    doc.text(`Mata Pelajaran  : ${mapel}`, 14, 38);
    doc.text(`Guru            : ${user.nama_lengkap || user.username || "-"}`, 14, 44);

    autoTable(doc, {
      startY: 50,
      head: [["No", "Nama Siswa", "Nilai Akhir Asli", "Rata-rata Sumatif", "Nilai STS", "Nilai SAS", "Tagihan Tugas", "Kriteria", "Nilai Final"]],
      body: filteredRows.map((r, i) => [
        i + 1,
        r.nama,
        r.nilaiAsli,
        r.rataRataSumatif !== null ? r.rataRataSumatif.toFixed(1) : "-",
        r.nilaiSTS ?? "-",
        r.nilaiSAS ?? "-",
        r.formatifBelum,
        r.kriteria,
        r.nilaiFinal,
      ]),
      styles: { fontSize: 9, cellPadding: 2, halign: "center", valign: "middle" },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, halign: "center", fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { halign: "left", cellWidth: 48 },
        2: { cellWidth: 18 },
        3: { cellWidth: 18 },
        4: { cellWidth: 14 },
        5: { cellWidth: 14 },
        6: { cellWidth: 18 },
        7: { cellWidth: 18 },
        8: { cellWidth: 18 },
      },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 14, right: 14 },
      didDrawPage: (data) => {
        const str = `Halaman ${doc.getNumberOfPages()}`;
        doc.setFontSize(8);
        doc.text(str, pageW - 14, doc.internal.pageSize.getHeight() - 8, { align: "right" });
      },
    });

    const safeKelas = (kelas || "kelas").replace(/[^\w-]+/g, "_");
    const safeMapel = (mapel || "mapel").replace(/[^\w-]+/g, "_");
    doc.save(`Pengelolaan_Nilai_${safeKelas}_${safeMapel}.pdf`);
    toast({ title: "Berhasil", description: "File PDF berhasil diunduh" });
  };

  const ready = kelas && mapel;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 flex items-center justify-center shadow-md shadow-orange-500/40">
            <Sparkles className="w-5 h-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">Pengelolaan Nilai</h2>
        </div>
        <p className="text-sm text-foreground/70 mt-2.5 pl-3 border-l-[3px] border-primary font-medium">
          Nilai final otomatis ditentukan berdasarkan kriteria nilai akhir asli.
        </p>
      </div>

      {/* Filter kelas & mapel */}
      <div className="bg-card border rounded-xl p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
              Kelas
            </label>
            <select
              value={kelas}
              onChange={(e) => { setKelas(e.target.value); setShowResults(false); setFilterIdx(null); }}
              className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm"
            >
              <option value="">Pilih Kelas</option>
              {kelasOptions.map((k) => (
                <option key={k.id} value={k.nama}>
                  {k.nama}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
              Mata Pelajaran
            </label>
            <select
              value={mapel}
              onChange={(e) => { setMapel(e.target.value); setShowResults(false); setFilterIdx(null); }}
              className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm"
            >
              <option value="">Pilih Mapel</option>
              {mapelOptions.map((m) => (
                <option key={m.id} value={m.nama}>
                  {m.nama}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Auto Filter */}
      {ready && (
        <div className="bg-card border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold uppercase tracking-wider">Auto Filter Kriteria</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Klik salah satu kriteria untuk menampilkan siswa berdasarkan rentang nilai akhir asli.
          </p>
          <div className="flex flex-wrap gap-2">
            {KRITERIA.map((k, i) => (
              <button
                key={k.label}
                onClick={() => handleAutoFilter(i)}
                className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                  filterIdx === i ? "ring-2 ring-primary " + k.color : k.color + " hover:opacity-80"
                }`}
              >
                {k.label} → {k.finalValue}
              </button>
            ))}
            <button
              onClick={handleShowAll}
              className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                filterIdx === null && showResults
                  ? "ring-2 ring-primary bg-primary/10 text-primary border-primary/40"
                  : "bg-muted/40 text-foreground hover:bg-muted"
              }`}
            >
              Tampilkan Semua
            </button>
          </div>
        </div>
      )}

      {/* Tabel hasil */}
      {ready && showResults && (
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b bg-muted/30">
            <div>
              <h3 className="text-sm font-semibold">
                {filterIdx !== null ? KRITERIA[filterIdx].label : "Semua Siswa"}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {filteredRows.length} siswa ditemukan
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    disabled={filteredRows.length === 0}
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportExcel} className="gap-2 cursor-pointer">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    Export Excel (.xlsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportPDF} className="gap-2 cursor-pointer">
                    <FileText className="w-4 h-4 text-rose-600" />
                    Export PDF (.pdf)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                onClick={handleSaveAll}
                disabled={saving || filteredRows.length === 0}
                size="sm"
                className="gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span className="hidden sm:inline">{saving ? "Menyimpan..." : "Simpan Pengelolaan"}</span>
                <span className="sm:hidden">{saving ? "..." : "Simpan"}</span>
              </Button>
            </div>
          </div>

          {/* Bulk Edit Nilai Final */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-3 border-b bg-primary/5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
              <Pencil className="w-3.5 h-3.5" />
              Tambah Nilai Massal
            </div>
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <Input
                type="number"
                min={0}
                max={100}
                value={bulkValue}
                onChange={(e) => setBulkValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleBulkApply(); }}
                placeholder="Mis. 10"
                className="h-9 w-24 text-center"
              />
              <Button
                onClick={handleBulkApply}
                disabled={filteredRows.length === 0}
                size="sm"
                variant="default"
                className="gap-1.5"
              >
                <Check className="w-4 h-4" />
                Tambahkan ke {filteredRows.length} Siswa
              </Button>
              <Button
                onClick={handleBulkReset}
                disabled={filteredRows.length === 0}
                size="sm"
                variant="ghost"
                className="gap-1.5"
              >
                <X className="w-4 h-4" />
                Reset
              </Button>
              <p className="text-[11px] text-muted-foreground basis-full sm:basis-auto sm:ml-auto">
                Masukkan angka tambahan (mis. 10), Nilai Final tiap siswa akan terakumulasi otomatis (maks. 100). Klik <span className="font-semibold">Simpan Pengelolaan</span> untuk menyimpan.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="text-left py-3 px-4 font-semibold">No</th>
                  <th className="text-left py-3 px-4 font-semibold">Nama Siswa</th>
                  <th className="text-center py-3 px-4 font-semibold">Nilai Akhir Asli</th>
                  <th className="text-center py-3 px-4 font-semibold text-blue-600">Rata-rata Sumatif</th>
                  <th className="text-center py-3 px-4 font-semibold">Nilai STS</th>
                  <th className="text-center py-3 px-4 font-semibold">Nilai SAS</th>
                  <th className="text-center py-3 px-4 font-semibold" title="Jumlah tugas Formatif yang belum dikerjakan">Tagihan Tugas</th>
                  <th className="text-center py-3 px-4 font-semibold">Kriteria</th>
                  <th className="text-center py-3 px-4 font-semibold text-primary">Nilai Final</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r, i) => {
                  const k = getKriteria(r.nilaiAsli);
                  return (
                    <tr key={r.studentId} className="border-t hover:bg-muted/20">
                      <td className="py-3 px-4 text-muted-foreground">{i + 1}</td>
                      <td className="py-3 px-4 font-medium">{r.nama}</td>
                      <td className="py-3 px-4 text-center font-semibold">{r.nilaiAsli}</td>
                      <td className="py-3 px-4 text-center font-semibold text-blue-600">
                        {r.rataRataSumatif !== null ? r.rataRataSumatif.toFixed(1) : "-"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {r.nilaiSTS !== null ? (
                          <span
                            className={`inline-block px-2 py-1 rounded-md border text-[11px] font-semibold ${
                              r.nilaiSTS >= 75
                                ? "bg-emerald-500/15 text-emerald-700 border-emerald-300"
                                : "bg-rose-500/15 text-rose-700 border-rose-300"
                            }`}
                            title="Nilai STS dari Rekap Nilai (pertimbangan)"
                          >
                            {r.nilaiSTS}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {r.nilaiSAS !== null ? (
                          <span
                            className={`inline-block px-2 py-1 rounded-md border text-[11px] font-semibold ${
                              r.nilaiSAS >= 75
                                ? "bg-emerald-500/15 text-emerald-700 border-emerald-300"
                                : "bg-rose-500/15 text-rose-700 border-rose-300"
                            }`}
                            title="Nilai SAS dari Rekap Nilai (pertimbangan)"
                          >
                            {r.nilaiSAS}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {r.formatifBelum > 0 ? (
                          <span
                            className="inline-block px-2 py-1 rounded-md border text-[11px] font-semibold bg-amber-500/15 text-amber-700 border-amber-300"
                            title="Jumlah tugas Formatif yang belum dikerjakan"
                          >
                            {r.formatifBelum} tugas
                          </span>
                        ) : (
                          <span
                            className="inline-block px-2 py-1 rounded-md border text-[11px] font-semibold bg-emerald-500/15 text-emerald-700 border-emerald-300"
                            title="Semua tugas Formatif sudah dikerjakan"
                          >
                            Lengkap
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {k && (
                          <span className={`inline-block px-2 py-1 rounded-md border text-[11px] ${k.color}`}>
                            {k.label}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-primary">
                        {editingId === r.studentId ? (
                          <div className="flex items-center justify-center gap-1">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={editValue}
                              autoFocus
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  const n = parseFloat(editValue);
                                  if (!isNaN(n)) {
                                    setOverrides({ ...overrides, [r.studentId]: Math.min(100, Math.max(0, Math.round(n))) });
                                  }
                                  setEditingId(null);
                                } else if (e.key === "Escape") {
                                  setEditingId(null);
                                }
                              }}
                              className="w-20 h-8 text-center"
                            />
                            <button
                              onClick={() => {
                                const n = parseFloat(editValue);
                                if (!isNaN(n)) {
                                  setOverrides({ ...overrides, [r.studentId]: Math.min(100, Math.max(0, Math.round(n))) });
                                }
                                setEditingId(null);
                              }}
                              className="text-emerald-600 hover:bg-emerald-50 rounded p-1"
                              title="Simpan"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-rose-600 hover:bg-rose-50 rounded p-1"
                              title="Batal"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <span>{r.nilaiFinal}</span>
                            <button
                              onClick={() => {
                                setEditingId(r.studentId);
                                setEditValue(String(r.nilaiFinal));
                              }}
                              className="text-muted-foreground hover:text-primary opacity-60 hover:opacity-100 transition"
                              title="Edit nilai final"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-muted-foreground">
                      Tidak ada siswa pada kriteria ini
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {ready && !showResults && (
        <div className="bg-card border rounded-xl p-10 text-center text-muted-foreground text-sm">
          Pilih salah satu kriteria di atas untuk memulai Auto Filter.
        </div>
      )}
    </div>
  );
}
