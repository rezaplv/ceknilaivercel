import { useState, useEffect, useMemo, useCallback } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuth } from "@/contexts/AuthContext";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { fetchScores, fetchKelasList, fetchMapelList, updateScoreValue, renameNamaPenilaian, snapshotAndDeleteScoresByJenis, fetchScoreArchive, restoreScoreArchive, purgeScoreArchive } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, Pencil, Check, X, FileSpreadsheet, FileText, FileDown, History, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { exportToExcel, exportToPDF, exportToWord, type ExportData } from "@/lib/exportRekapNilai";

import { VIEW_OPTIONS_WITH_LABELS, getJenisLabel, getJenisPrefix } from "@/lib/jenisLabels";

function calcNA(avgF: number | null, avgS: number | null, sts: number | null, sas: number | null) {
  const f = avgF ?? 0;
  const s = avgS ?? 0;
  const st = (sts !== null && sts >= 0) ? sts : 0;
  const sa = (sas !== null && sas >= 0) ? sas : 0;
  const total = 2 * f + 2 * s + st + sa;
  return (total / 6).toFixed(1);
}

interface EditingCell {
  scoreId: string;
  value: string;
}

export default function RekapNilai() {
  const { user } = useAuth();
  const { semester, tahunAjaran } = useAppSettings();
  usePageTitle("Rekap Nilai");
  const [kelas, setKelas] = useState("");
  const [mapel, setMapel] = useState("");
  const [view, setView] = useState("ALL");
  const [allScores, setAllScores] = useState<any[]>([]);
  const [kelasList, setKelasList] = useState<{ id: string; nama: string }[]>([]);
  const [mapelList, setMapelList] = useState<{ id: string; nama: string }[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{ jenis: string; nama?: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editingHeader, setEditingHeader] = useState<{ jenis: string; oldName: string; newName: string } | null>(null);
  const [savingHeader, setSavingHeader] = useState(false);

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

  const [showArchive, setShowArchive] = useState(false);
  const [archiveList, setArchiveList] = useState<any[]>([]);
  const [loadingArchive, setLoadingArchive] = useState(false);

  const loadArchive = useCallback(async () => {
    setLoadingArchive(true);
    const data = await fetchScoreArchive();
    setArchiveList(data);
    setLoadingArchive(false);
  }, []);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const kelasObj = kelasList.find(k => k.nama === kelas);
    const mapelObj = mapelList.find(m => m.nama === mapel);
    if (!kelasObj || !mapelObj) return;
    setDeleting(true);
    try {
      const ctx = deleteConfirm.nama ? "rekap_single" : "rekap_bulk";
      const n = await snapshotAndDeleteScoresByJenis(kelasObj.id, mapelObj.id, deleteConfirm.jenis, deleteConfirm.nama, ctx);
      toast({ title: "Berhasil", description: `${n} nilai dihapus & disimpan ke Riwayat Hapus (dapat dipulihkan)` });
      loadScores(kelas, mapel);
    } catch (e: any) {
      toast({ title: "Gagal", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  };

  const handleRestoreArchive = async (id: string) => {
    try {
      const n = await restoreScoreArchive(id);
      toast({ title: "Dipulihkan", description: `${n} nilai berhasil dipulihkan` });
      loadArchive();
      if (kelas && mapel) loadScores(kelas, mapel);
    } catch (e: any) {
      toast({ title: "Gagal", description: e.message, variant: "destructive" });
    }
  };

  const handlePurgeArchive = async (id: string) => {
    if (!confirm("Hapus permanen entri arsip ini? Tidak bisa dipulihkan lagi.")) return;
    await purgeScoreArchive(id);
    toast({ title: "Dihapus permanen" });
    loadArchive();
  };

  const handleHeaderRename = async () => {
    if (!editingHeader) return;
    const trimmed = editingHeader.newName.trim();
    if (!trimmed || trimmed === editingHeader.oldName) {
      setEditingHeader(null);
      return;
    }
    const kelasObj = kelasList.find(k => k.nama === kelas);
    const mapelObj = mapelList.find(m => m.nama === mapel);
    if (!kelasObj || !mapelObj) return;
    setSavingHeader(true);
    try {
      await renameNamaPenilaian(kelasObj.id, mapelObj.id, editingHeader.jenis, editingHeader.oldName, trimmed);
      toast({ title: "Berhasil", description: `Nama penilaian diubah menjadi "${trimmed}"` });
      setEditingHeader(null);
      loadScores(kelas, mapel);
    } catch (e: any) {
      toast({ title: "Gagal", description: e.message, variant: "destructive" });
    } finally {
      setSavingHeader(false);
    }
  };

  const handleEditSave = async () => {
    if (!editing) return;
    const raw = editing.value.trim();
    const parsed = parseFloat(raw);
    const isNonNumeric = raw === "" || isNaN(parsed);
    const nilaiAsli = isNonNumeric ? -1 : parsed;
    if (!isNonNumeric && (nilaiAsli < 0 || nilaiAsli > 100)) {
      toast({ title: "Error", description: "Nilai harus antara 0-100, atau gunakan '.' / '-' untuk Belum Mengerjakan", variant: "destructive" });
      return;
    }
    // For SUMATIF/STS/SAS: if below KKM, set nilai to KKM and store original in nilai_asli
    const scoreEntry = allScores.find((s: any) => s.id === editing.scoreId);
    const jenis = scoreEntry?.jenis;
    const kkm = scoreEntry ? Number(scoreEntry.kkm) : 75;
    const isBelowKkm = nilaiAsli >= 0 && nilaiAsli < kkm && ["SUMATIF", "STS", "SAS"].includes(jenis);
    const finalNilai = isBelowKkm ? kkm : nilaiAsli;
    const finalNilaiAsli = isBelowKkm ? nilaiAsli : null;

    setSavingEdit(true);
    try {
      await updateScoreValue(editing.scoreId, finalNilai, finalNilaiAsli);
      toast({ title: "Berhasil", description: "Nilai berhasil diperbarui" });
      setEditing(null);
      loadScores(kelas, mapel);
    } catch (e: any) {
      toast({ title: "Gagal", description: e.message, variant: "destructive" });
    } finally {
      setSavingEdit(false);
    }
  };

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

  const getScore = (studentId: string, jenis: string, namaPenilaian?: string) =>
    allScores.find((s: any) => s.student_id === studentId && s.jenis === jenis && (namaPenilaian ? s.nama_penilaian === namaPenilaian : true));

  const getScoresFor = (studentId: string, jenis: string) =>
    allScores.filter((s: any) => s.student_id === studentId && s.jenis === jenis && s.nilai_type === "angka");

  const avg = (nums: number[]) => (nums.length > 0 ? nums.map(n => n < 0 ? 0 : n).reduce((a, b) => a + b, 0) / nums.length : null);

  const handleExport = (type: "excel" | "pdf" | "word") => {
    const exportData: ExportData = {
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
      if (type === "excel") exportToExcel(exportData);
      else if (type === "pdf") exportToPDF(exportData);
      else exportToWord(exportData);
      toast({ title: "Berhasil", description: `File ${type.toUpperCase()} berhasil diunduh` });
    } catch (e: any) {
      toast({ title: "Gagal", description: e.message, variant: "destructive" });
    }
  };

  const renderEditableNilai = (entry: any) => {
    if (!entry) return <span className="text-muted-foreground">-</span>;
    if (entry.nilai_type === "ceklis") return entry.nilai === 1 ? "✓" : "✗";

    const isEditing = editing?.scoreId === entry.id;

    if (isEditing) {
      return (
        <div className="flex items-center justify-center gap-1">
          <input
            type="text"
            value={editing.value}
            onChange={(e) => setEditing({ ...editing, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleEditSave();
              if (e.key === "Escape") setEditing(null);
            }}
            autoFocus
            className="w-16 px-2 py-1 rounded border bg-background text-sm text-center"
            disabled={savingEdit}
          />
          <button onClick={handleEditSave} disabled={savingEdit} className="p-1 rounded hover:bg-green-100 text-green-600 transition-colors" title="Simpan">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setEditing(null)} disabled={savingEdit} className="p-1 rounded hover:bg-red-100 text-red-500 transition-colors" title="Batal">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      );
    }

    const belumMengerjakan = Number(entry.nilai) < 0;
    return (
      <button
        onClick={() => setEditing({ scoreId: entry.id, value: belumMengerjakan ? "-" : String(entry.nilai) })}
        className="group/edit inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-primary/10 transition-colors cursor-pointer"
        title="Klik untuk edit"
      >
        <span>{belumMengerjakan ? <span className="text-muted-foreground italic">-</span> : entry.nilai}</span>
        <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover/edit:opacity-100 transition-opacity" />
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 flex items-center justify-center shadow-md shadow-orange-500/40">
              <FileSpreadsheet className="w-5 h-5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">Rekap Nilai</h2>
          </div>
          <p className="text-sm text-foreground/70 mt-2.5 pl-3 border-l-[3px] border-primary font-medium">
            Lihat rekapitulasi nilai siswa — klik nilai untuk mengedit
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => { setShowArchive(true); loadArchive(); }} className="gap-1.5">
            <History className="h-4 w-4" /> Riwayat Hapus
          </Button>
          {showTable && students.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={() => handleExport("excel")} className="gap-1.5">
                <FileSpreadsheet className="h-4 w-4" /> Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} className="gap-1.5">
                <FileText className="h-4 w-4" /> PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport("word")} className="gap-1.5">
                <FileDown className="h-4 w-4" /> Word
              </Button>
            </>
          )}
        </div>
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
        <>
          <div className="bg-card border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Hapus Nilai Berdasarkan Jenis</h3>
            <div className="flex flex-wrap gap-2">
              {formatifNames.map((name) => (
                <Button key={`del-f-${name}`} variant="outline" size="sm" onClick={() => setDeleteConfirm({ jenis: "FORMATIF", nama: name })} className="text-destructive border-destructive/30 hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> {getJenisPrefix("FORMATIF")}: {name}
                </Button>
              ))}
              {sumatifNames.map((name) => (
                <Button key={`del-s-${name}`} variant="outline" size="sm" onClick={() => setDeleteConfirm({ jenis: "SUMATIF", nama: name })} className="text-destructive border-destructive/30 hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> {getJenisPrefix("SUMATIF")}: {name}
                </Button>
              ))}
              {allScores.some((s: any) => s.jenis === "STS") && (
                <Button variant="outline" size="sm" onClick={() => setDeleteConfirm({ jenis: "STS" })} className="text-destructive border-destructive/30 hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> STS
                </Button>
              )}
              {allScores.some((s: any) => s.jenis === "SAS") && (
                <Button variant="outline" size="sm" onClick={() => setDeleteConfirm({ jenis: "SAS" })} className="text-destructive border-destructive/30 hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> SAS
                </Button>
              )}
            </div>
          </div>

          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground sticky left-0 z-20 bg-muted/50 min-w-[48px]">No</th>
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground sticky left-[48px] z-20 bg-muted/50 min-w-[180px] after:content-[''] after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-border">Nama Siswa</th>
                    {(view === "ALL" || view === "FORMATIF") && formatifNames.map((name) => (
                      <th key={`fh-${name}`} className="text-center py-3 px-4 font-semibold text-muted-foreground text-xs">
                        {editingHeader?.jenis === "FORMATIF" && editingHeader?.oldName === name ? (
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="text"
                              value={editingHeader.newName}
                              onChange={(e) => setEditingHeader({ ...editingHeader, newName: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleHeaderRename();
                                if (e.key === "Escape") setEditingHeader(null);
                              }}
                              autoFocus
                              className="w-32 px-2 py-1 rounded border bg-background text-xs text-center"
                              disabled={savingHeader}
                            />
                            <button onClick={handleHeaderRename} disabled={savingHeader} className="p-1 rounded hover:bg-accent text-primary transition-colors" title="Simpan">
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setEditingHeader(null)} disabled={savingHeader} className="p-1 rounded hover:bg-accent text-destructive transition-colors" title="Batal">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingHeader({ jenis: "FORMATIF", oldName: name, newName: name })}
                            className="group/hdr inline-flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
                            title="Klik untuk rename"
                          >
                            <span>{view === "FORMATIF" ? name : `${getJenisPrefix("FORMATIF")}: ${name}`}</span>
                            <Pencil className="h-3 w-3 opacity-0 group-hover/hdr:opacity-100 transition-opacity" />
                          </button>
                        )}
                      </th>
                    ))}
                    {(view === "ALL" || view === "FORMATIF") && formatifNames.length > 1 && (
                      <th className="text-center py-3 px-4 font-semibold text-blue-600 text-xs">Rata-rata {getJenisPrefix("FORMATIF")}</th>
                    )}
                    {(view === "ALL" || view === "SUMATIF") && sumatifNames.map((name) => (
                      <th key={`sh-${name}`} className="text-center py-3 px-4 font-semibold text-muted-foreground text-xs">
                        {editingHeader?.jenis === "SUMATIF" && editingHeader?.oldName === name ? (
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="text"
                              value={editingHeader.newName}
                              onChange={(e) => setEditingHeader({ ...editingHeader, newName: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleHeaderRename();
                                if (e.key === "Escape") setEditingHeader(null);
                              }}
                              autoFocus
                              className="w-32 px-2 py-1 rounded border bg-background text-xs text-center"
                              disabled={savingHeader}
                            />
                            <button onClick={handleHeaderRename} disabled={savingHeader} className="p-1 rounded hover:bg-accent text-primary transition-colors" title="Simpan">
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setEditingHeader(null)} disabled={savingHeader} className="p-1 rounded hover:bg-accent text-destructive transition-colors" title="Batal">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingHeader({ jenis: "SUMATIF", oldName: name, newName: name })}
                            className="group/hdr inline-flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
                            title="Klik untuk rename"
                          >
                            <span>{view === "SUMATIF" ? name : `${getJenisPrefix("SUMATIF")}: ${name}`}</span>
                            <Pencil className="h-3 w-3 opacity-0 group-hover/hdr:opacity-100 transition-opacity" />
                          </button>
                        )}
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
                    const fScores = getScoresFor(st.id, "FORMATIF");
                    const sScores = getScoresFor(st.id, "SUMATIF");
                    const avgF = avg(fScores.map((s: any) => Number(s.nilai)));
                    const avgS = avg(sScores.map((s: any) => Number(s.nilai)));
                    const stsEntry = getScore(st.id, "STS");
                    const sasEntry = getScore(st.id, "SAS");
                    const stsVal = stsEntry ? Number(stsEntry.nilai) : null;
                    const sasVal = sasEntry ? Number(sasEntry.nilai) : null;
                    const na = calcNA(avgF, avgS, stsVal, sasVal);

                    return (
                      <tr key={st.id} className="border-t hover:bg-muted/30 transition-colors group">
                        <td className="py-3 px-4 text-muted-foreground sticky left-0 z-10 bg-card group-hover:bg-muted/30 transition-colors">{i + 1}</td>
                        <td className="py-3 px-4 font-medium sticky left-[48px] z-10 bg-card group-hover:bg-muted/30 transition-colors after:content-[''] after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-border">{st.nama}</td>
                        {(view === "ALL" || view === "FORMATIF") && formatifNames.map((name) => (
                          <td key={`f-${st.id}-${name}`} className="py-3 px-4 text-center">{renderEditableNilai(getScore(st.id, "FORMATIF", name))}</td>
                        ))}
                        {(view === "ALL" || view === "FORMATIF") && formatifNames.length > 1 && (
                          <td className="py-3 px-4 text-center font-semibold text-blue-600">{avgF !== null ? avgF.toFixed(1) : "-"}</td>
                        )}
                        {(view === "ALL" || view === "SUMATIF") && sumatifNames.map((name) => (
                          <td key={`s-${st.id}-${name}`} className="py-3 px-4 text-center">{renderEditableNilai(getScore(st.id, "SUMATIF", name))}</td>
                        ))}
                        {(view === "ALL" || view === "SUMATIF") && sumatifNames.length >= 1 && (
                          <td className="py-3 px-4 text-center font-semibold text-blue-600">{avgS !== null ? avgS.toFixed(1) : "-"}</td>
                        )}
                        {(view === "ALL" || view === "STS") && <td className="py-3 px-4 text-center">{renderEditableNilai(stsEntry)}</td>}
                        {(view === "ALL" || view === "SAS") && <td className="py-3 px-4 text-center">{renderEditableNilai(sasEntry)}</td>}
                        {view === "ALL" && <td className="py-3 px-4 text-center font-bold text-primary">{na ?? "-"}</td>}
                      </tr>
                    );
                  })}
                  {students.length === 0 && (
                    <tr><td colSpan={20} className="py-8 text-center text-muted-foreground">Belum ada data nilai untuk kelas dan mapel ini</td></tr>
                  )}
                  {students.length > 0 && view === "FORMATIF" && formatifNames.length === 0 && (
                    <tr><td colSpan={20} className="py-8 text-center text-muted-foreground">Belum ada data nilai Tugas (Formatif) untuk kelas dan mapel ini</td></tr>
                  )}
                  {students.length > 0 && view === "SUMATIF" && sumatifNames.length === 0 && (
                    <tr><td colSpan={20} className="py-8 text-center text-muted-foreground">Belum ada data nilai Ulangan Harian (Sumatif) untuk kelas dan mapel ini</td></tr>
                  )}
                  {students.length > 0 && view === "STS" && !allScores.some((s: any) => s.jenis === "STS") && (
                    <tr><td colSpan={20} className="py-8 text-center text-muted-foreground">Belum ada data nilai STS untuk kelas dan mapel ini</td></tr>
                  )}
                  {students.length > 0 && view === "SAS" && !allScores.some((s: any) => s.jenis === "SAS") && (
                    <tr><td colSpan={20} className="py-8 text-center text-muted-foreground">Belum ada data nilai SAS untuk kelas dan mapel ini</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border rounded-xl p-6 max-w-md w-full mx-4 shadow-lg">
            <h3 className="text-lg font-semibold mb-2">Konfirmasi Hapus</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Yakin menghapus semua nilai <strong>{deleteConfirm.nama || deleteConfirm.jenis}</strong> untuk kelas <strong>{kelas}</strong> mapel <strong>{mapel}</strong>?
              <br /><span className="text-xs italic text-primary">Data akan disimpan ke <strong>Riwayat Hapus</strong> dan dapat dipulihkan kapan saja.</span>
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)} disabled={deleting}>Batal</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Menghapus..." : "Hapus"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showArchive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowArchive(false)}>
          <div className="bg-card border rounded-xl shadow-lg w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-bold">Riwayat Hapus Nilai</h3>
              </div>
              <button onClick={() => setShowArchive(false)} className="p-1.5 rounded-lg hover:bg-muted">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 text-xs text-muted-foreground border-b bg-muted/30">
              {user?.role === "ADMIN" ? "Menampilkan arsip dari semua guru." : "Menampilkan arsip nilai yang Anda hapus. Pulihkan dalam 30 hari."}
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {loadingArchive ? (
                <div className="text-center py-8 text-muted-foreground">Memuat...</div>
              ) : archiveList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Belum ada riwayat hapus.</div>
              ) : (
                <div className="space-y-2">
                  {archiveList.map((a) => (
                    <div key={a.id} className="border rounded-lg p-3 flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {a.kelas_nama} • {a.mapel_nama} • {a.jenis}
                          {a.nama_penilaian && <span className="text-muted-foreground"> — {a.nama_penilaian}</span>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {a.note} • {new Date(a.deleted_at).toLocaleString("id-ID")}
                          {user?.role === "ADMIN" && <> • oleh <strong>{a.deleted_by_nama}</strong></>}
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button size="sm" variant="outline" onClick={() => handleRestoreArchive(a.id)} className="gap-1">
                          <Undo2 className="h-3.5 w-3.5" /> Pulihkan
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handlePurgeArchive(a.id)} className="text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
