import { useState, useEffect, useRef } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuth } from "@/contexts/AuthContext";
import { ClipboardEdit, Upload, Table2, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchKelasList, fetchMapelList, fetchStudentsByKelas, insertScores } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { RankingToggle } from "@/components/RankingToggle";

type InputMode = "manual" | "batch" | "csv";

import { JENIS_LABEL, getJenisLabel } from "@/lib/jenisLabels";

const JENIS_OPTIONS = ["FORMATIF", "SUMATIF", "STS", "SAS"];

export default function InputNilai() {
  const { user } = useAuth();
  const { toast } = useToast();
  usePageTitle("Input Nilai");
  const [mode, setMode] = useState<InputMode>("manual");
  const [kelas, setKelas] = useState("");
  const [mapel, setMapel] = useState("");
  const [jenis, setJenis] = useState("");
  const [namaPenilaian, setNamaPenilaian] = useState("");
  const [kkm, setKkm] = useState("75");
  const [autoKkm, setAutoKkm] = useState(true);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [batchText, setBatchText] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [kelasList, setKelasList] = useState<{ id: string; nama: string }[]>([]);
  const [mapelList, setMapelList] = useState<{ id: string; nama: string }[]>([]);
  const [students, setStudents] = useState<{ user_id: string; nama_lengkap: string }[]>([]);

  useEffect(() => {
    Promise.all([fetchKelasList(), fetchMapelList()]).then(([k, m]) => {
      setKelasList(k);
      setMapelList(m);
    });
  }, []);

  useEffect(() => {
    if (kelas) {
      fetchStudentsByKelas(kelas).then((s) => setStudents(s.map(st => ({ user_id: st.user_id, nama_lengkap: st.nama_lengkap })).sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap))));
    } else {
      setStudents([]);
    }
  }, [kelas]);

  if (!user || user.role === "SISWA") return null;

  const kelasOptions = user.role === "GURU" && user.kelas?.length ? kelasList.filter(k => user.kelas!.includes(k.nama)) : kelasList;
  const mapelOptions = user.role === "GURU" && user.mapel?.length ? mapelList.filter(m => user.mapel!.includes(m.nama)) : mapelList;

  const showNamaPenilaian = jenis === "FORMATIF" || jenis === "SUMATIF";

  const handleSave = async () => {
    if (!kelas || !mapel || !jenis) return;
    const kelasObj = kelasList.find(k => k.nama === kelas);
    const mapelObj = mapelList.find(m => m.nama === mapel);
    if (!kelasObj || !mapelObj) return;

    const entries = students
      .filter(s => scores[s.user_id])
      .map(s => {
        const raw = scores[s.user_id].trim();
        const parsed = parseFloat(raw);
        // If input is non-numeric (e.g. ".", "-"), save as -1 to indicate "Belum Mengerjakan"
        const nilaiAsli = isNaN(parsed) ? -1 : parsed;
        const kkmVal = parseFloat(kkm) || 75;
        // Auto-detect: for SUMATIF/STS/SAS, if below KKM and autoKkm is enabled, show KKM in rekap but keep original for student
        const isBelowKkm = autoKkm && nilaiAsli >= 0 && nilaiAsli < kkmVal && ["SUMATIF", "STS", "SAS"].includes(jenis);
        return {
          kelas_id: kelasObj.id,
          mapel_id: mapelObj.id,
          jenis,
          nama_penilaian: showNamaPenilaian ? namaPenilaian || jenis : jenis,
          student_id: s.user_id,
          nilai: isBelowKkm ? kkmVal : nilaiAsli,
          nilai_asli: isBelowKkm ? nilaiAsli : null,
          nilai_type: "angka",
          visible: visible[s.user_id] !== false,
          created_by: user.user_id,
          kkm: kkmVal,
        };
      });

    if (entries.length === 0) {
      toast({ title: "Error", description: "Tidak ada nilai untuk disimpan", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await insertScores(entries);
      toast({ title: "Berhasil", description: `${entries.length} nilai berhasil disimpan` });

      setScores({});
      setVisible({});
      setBatchText("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Gagal menyimpan", variant: "destructive" });
    }
    setSaving(false);
  };

  const filledCount = students.filter(s => scores[s.user_id] && scores[s.user_id].trim() !== "").length;

  const requestSave = () => {
    if (!kelas || !mapel || !jenis) {
      toast({ title: "Lengkapi data", description: "Pilih kelas, mata pelajaran, dan jenis penilaian terlebih dahulu", variant: "destructive" });
      return;
    }
    if (filledCount === 0) {
      toast({ title: "Belum ada nilai", description: "Isi minimal satu nilai siswa sebelum menyimpan", variant: "destructive" });
      return;
    }
    setConfirmOpen(true);
  };

  const confirmSave = async () => {
    setConfirmOpen(false);
    await handleSave();
  };

  const handleDownloadTemplate = () => {
    const isFormatif = (!!jenis);
    const header = isFormatif ? "Nama Siswa,Nilai,Tampilkan" : "Nama Siswa,Nilai";
    const rows = students.map((s) => isFormatif ? `${s.nama_lengkap},,Ya` : `${s.nama_lengkap},`);
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `template_nilai_${kelas || "kelas"}_${mapel || "mapel"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCsvParse = (file: File) => {
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) return;
      const newScores: Record<string, string> = {};
      const newVisible: Record<string, boolean> = {};
      for (let i = 1; i < lines.length; i++) {
        const sep = lines[i].includes(";") ? ";" : ",";
        const cols = lines[i].split(sep).map(c => c.trim());
        const nama = cols[0];
        const nilai = cols[1] || "";
        const tampilkan = cols[2]?.toLowerCase();
        const student = students.find(s => s.nama_lengkap.toLowerCase() === nama.toLowerCase());
        if (student && nilai) {
          newScores[student.user_id] = nilai;
          newVisible[student.user_id] = tampilkan === "tidak" ? false : true;
        }
      }
      setScores(newScores);
      setVisible(newVisible);
    };
    reader.readAsText(file);
  };

  const modes: { key: InputMode; label: string; icon: React.ElementType }[] = [
    { key: "manual", label: "Manual", icon: ClipboardEdit },
    { key: "batch", label: "Batch Input", icon: Table2 },
    { key: "csv", label: "Upload CSV", icon: Upload },
  ];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 flex items-center justify-center shadow-md shadow-orange-500/40">
            <ClipboardEdit className="w-5 h-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">Input Nilai</h2>
        </div>
        <p className="text-sm text-foreground/70 mt-2.5 pl-3 border-l-[3px] border-primary font-medium">
          Masukkan nilai siswa berdasarkan kelas dan mata pelajaran
        </p>
      </div>

      <div className="flex gap-2">
        {modes.map((m) => (
          <button key={m.key} onClick={() => setMode(m.key)} className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all", mode === m.key ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
            <m.icon className="w-4 h-4" />
            {m.label}
          </button>
        ))}
      </div>

      <div className="bg-card border rounded-xl p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Jenis Nilai</label>
            <select value={jenis} onChange={(e) => setJenis(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm">
              <option value="">Pilih Jenis</option>
              {JENIS_OPTIONS.map((j) => <option key={j} value={j}>{getJenisLabel(j)}</option>)}
            </select>
          </div>
          {showNamaPenilaian && (
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Nama Penilaian</label>
              <input type="text" value={namaPenilaian} onChange={(e) => setNamaPenilaian(e.target.value)} placeholder="Contoh: Kuis Bab 1" className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm" />
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">KKM</label>
            <input type="number" inputMode="numeric" pattern="[0-9]*" min={0} max={100} value={kkm} onChange={(e) => setKkm(e.target.value)} placeholder="75" className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm" />
          </div>
          {["SUMATIF", "STS", "SAS"].includes(jenis) && (
            <div className="sm:col-span-2 lg:col-span-4">
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                Mode Nilai di Bawah KKM
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAutoKkm(true)}
                  className={cn(
                    "text-left px-3 py-2.5 rounded-lg border text-sm transition-all",
                    autoKkm
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-input bg-background hover:border-primary/40"
                  )}
                >
                  <div className="font-semibold">Otomatis ke KKM</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Nilai di bawah KKM ditampilkan = KKM di rekap. Nilai asli tetap disimpan & terlihat oleh siswa.
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setAutoKkm(false)}
                  className={cn(
                    "text-left px-3 py-2.5 rounded-lg border text-sm transition-all",
                    !autoKkm
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-input bg-background hover:border-primary/40"
                  )}
                >
                  <div className="font-semibold">Apa Adanya</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Nilai masuk ke rekap persis seperti yang diinputkan, tanpa penyesuaian KKM.
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {kelas && mapel && ["SUMATIF", "STS", "SAS"].includes(jenis) && (() => {
        const kObj = kelasList.find(k => k.nama === kelas);
        const mObj = mapelList.find(m => m.nama === mapel);
        if (!kObj || !mObj) return null;
        return <RankingToggle kelasId={kObj.id} mapelId={mObj.id} kelasNama={kelas} mapelNama={mapel} />;
      })()}


      {mode === "manual" && kelas && mapel && jenis && (
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground">No</th>
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Nama Siswa</th>
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Nilai</th>
                  {(!!jenis) && (
                    <th className="text-center py-3 px-4 font-semibold text-muted-foreground">
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex flex-col items-center gap-0.5"><span>Tampilkan</span><span className="text-[10px] font-normal normal-case">ke Siswa</span></div>
                        {students.length > 0 && (() => {
                          const allChecked = students.every(s => visible[s.user_id] !== false);
                          return (
                            <label className="flex items-center gap-1 cursor-pointer mt-1 normal-case font-normal text-[11px] text-primary hover:underline">
                              <input
                                type="checkbox"
                                checked={allChecked}
                                onChange={(e) => {
                                  const next: Record<string, boolean> = {};
                                  students.forEach(s => { next[s.user_id] = e.target.checked; });
                                  setVisible(next);
                                }}
                                className="w-3.5 h-3.5 rounded border-input accent-primary cursor-pointer"
                              />
                              <span>Ceklis Semua</span>
                            </label>
                          );
                        })()}
                      </div>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => (
                  <tr key={s.user_id} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 text-muted-foreground">{i + 1}</td>
                    <td className="py-3 px-4 font-medium">{s.nama_lengkap}</td>
                    <td className="py-3 px-4">
                      <input type="text" inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" value={scores[s.user_id] || ""} onChange={(e) => setScores({ ...scores, [s.user_id]: e.target.value })} className="w-24 px-3 py-1.5 rounded-lg border bg-background text-sm" placeholder="0-100" />
                    </td>
                    {(!!jenis) && (
                      <td className="py-3 px-4 text-center">
                        <input type="checkbox" checked={visible[s.user_id] !== false} onChange={(e) => setVisible({ ...visible, [s.user_id]: e.target.checked })} className="w-4 h-4 rounded border-input accent-primary cursor-pointer" />
                      </td>
                    )}
                  </tr>
                ))}
                {students.length === 0 && (
                  <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">Tidak ada siswa di kelas ini</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t flex justify-end">
            <button onClick={requestSave} disabled={saving} className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all shadow-md disabled:opacity-50">
              {saving ? "Menyimpan..." : "Simpan Nilai"}
            </button>
          </div>
        </div>
      )}

      {mode === "csv" && (
        <div className="bg-card border rounded-xl p-8">
          <div className="flex flex-col items-center text-center mb-6">
            <Upload className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="font-semibold">Upload File CSV</p>
            <p className="text-sm text-muted-foreground mt-1">Format: Nama Siswa, Nilai</p>
          </div>
          <div className="flex items-center justify-center gap-2 mb-6">
            <button onClick={handleDownloadTemplate} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-primary/30 text-primary text-sm font-medium hover:bg-primary/5 transition-colors">
              <Download className="w-4 h-4" />
              Download Template CSV
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept=".csv" onChange={(e) => { if (e.target.files?.[0]) handleCsvParse(e.target.files[0]); }} className="hidden" />
          <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-input rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all">
            {csvFile ? <p className="text-sm font-medium">{csvFile.name}</p> : <><p className="text-sm font-medium">Klik untuk memilih file</p><p className="text-xs text-muted-foreground mt-1">Format: .csv (Nama Siswa, Nilai{(!!jenis) ? ", Tampilkan" : ""})</p></>}
          </div>
          {csvFile && Object.keys(scores).length > 0 && (
            <div className="mt-4 overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left py-2 px-3 font-semibold text-muted-foreground text-xs">No</th>
                    <th className="text-left py-2 px-3 font-semibold text-muted-foreground text-xs">Nama Siswa</th>
                    <th className="text-center py-2 px-3 font-semibold text-muted-foreground text-xs">Nilai</th>
                    {(!!jenis) && (() => {
                      const csvStudents = students.filter(s => scores[s.user_id]);
                      const allChecked = csvStudents.length > 0 && csvStudents.every(s => visible[s.user_id] !== false);
                      return (
                        <th className="text-center py-2 px-3 font-semibold text-muted-foreground text-xs">
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex flex-col items-center gap-0.5"><span>Tampilkan</span><span className="text-[10px] font-normal normal-case">ke Siswa</span></div>
                            {csvStudents.length > 0 && (
                              <label className="flex items-center gap-1 cursor-pointer mt-1 normal-case font-normal text-[11px] text-primary hover:underline">
                                <input
                                  type="checkbox"
                                  checked={allChecked}
                                  onChange={(e) => {
                                    const next = { ...visible };
                                    csvStudents.forEach(s => { next[s.user_id] = e.target.checked; });
                                    setVisible(next);
                                  }}
                                  className="w-3.5 h-3.5 rounded border-input accent-primary cursor-pointer"
                                />
                                <span>Ceklis Semua</span>
                              </label>
                            )}
                          </div>
                        </th>
                      );
                    })()}
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, i) => (
                    scores[s.user_id] ? (
                      <tr key={s.user_id} className="border-t hover:bg-muted/30 transition-colors">
                        <td className="py-2 px-3 text-muted-foreground">{i + 1}</td>
                        <td className="py-2 px-3 font-medium">{s.nama_lengkap}</td>
                        <td className="py-2 px-3 text-center"><span className="inline-block px-3 py-1 rounded-lg bg-primary/10 text-primary font-semibold text-sm">{scores[s.user_id]}</span></td>
                        {(!!jenis) && (
                          <td className="py-2 px-3 text-center">
                            <input type="checkbox" checked={visible[s.user_id] !== false} onChange={(e) => setVisible({ ...visible, [s.user_id]: e.target.checked })} className="w-4 h-4 rounded border-input accent-primary cursor-pointer" />
                          </td>
                        )}
                      </tr>
                    ) : null
                  ))}
                </tbody>
              </table>
              <div className="p-3 border-t text-xs text-muted-foreground">{Object.keys(scores).length} siswa terdeteksi dari CSV</div>
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <button onClick={requestSave} disabled={saving || Object.keys(scores).length === 0} className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all shadow-md disabled:opacity-50">
              {saving ? "Menyimpan..." : "Upload & Simpan"}
            </button>
          </div>
        </div>
      )}

      {mode === "batch" && kelas && mapel && jenis && (
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="p-5 border-b space-y-3">
            <p className="text-sm text-muted-foreground">
              Paste nilai dari spreadsheet (satu nilai per baris), sistem akan otomatis memetakan ke daftar siswa sesuai urutan.
            </p>
            <textarea rows={5} value={batchText} onChange={(e) => {
              setBatchText(e.target.value);
              const lines = e.target.value.split("\n").map((l) => l.trim()).filter(Boolean);
              const newScores: Record<string, string> = {};
              students.forEach((s, i) => { if (lines[i]) newScores[s.user_id] = lines[i]; });
              setScores(newScores);
            }} placeholder={"85\n90\n78\n92\n88"} className="w-full px-4 py-3 rounded-lg border bg-background text-sm font-mono resize-none" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground">No</th>
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Nama Siswa</th>
                  <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Nilai</th>
                  {(!!jenis) && (
                    <th className="text-center py-3 px-4 font-semibold text-muted-foreground">
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex flex-col items-center gap-0.5"><span>Tampilkan</span><span className="text-[10px] font-normal normal-case">ke Siswa</span></div>
                        {students.length > 0 && (() => {
                          const allChecked = students.every(s => visible[s.user_id] !== false);
                          return (
                            <label className="flex items-center gap-1 cursor-pointer mt-1 normal-case font-normal text-[11px] text-primary hover:underline">
                              <input
                                type="checkbox"
                                checked={allChecked}
                                onChange={(e) => {
                                  const next: Record<string, boolean> = {};
                                  students.forEach(s => { next[s.user_id] = e.target.checked; });
                                  setVisible(next);
                                }}
                                className="w-3.5 h-3.5 rounded border-input accent-primary cursor-pointer"
                              />
                              <span>Ceklis Semua</span>
                            </label>
                          );
                        })()}
                      </div>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => (
                  <tr key={s.user_id} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 text-muted-foreground">{i + 1}</td>
                    <td className="py-3 px-4 font-medium">{s.nama_lengkap}</td>
                    <td className="py-3 px-4 text-center">
                      {scores[s.user_id] ? <span className="inline-block px-3 py-1 rounded-lg bg-primary/10 text-primary font-semibold text-sm">{scores[s.user_id]}</span> : <span className="text-muted-foreground italic text-xs">belum diisi</span>}
                    </td>
                    {(!!jenis) && (
                      <td className="py-3 px-4 text-center">
                        <input type="checkbox" checked={visible[s.user_id] !== false} onChange={(e) => setVisible({ ...visible, [s.user_id]: e.target.checked })} className="w-4 h-4 rounded border-input accent-primary cursor-pointer" />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{Object.keys(scores).length} dari {students.length} siswa terisi</p>
            <button onClick={requestSave} disabled={saving} className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all shadow-md disabled:opacity-50">
              {saving ? "Menyimpan..." : "Simpan Semua Nilai"}
            </button>
          </div>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Simpan Nilai</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Anda akan menyimpan nilai dengan rincian berikut:</p>
                <ul className="bg-muted/50 rounded-lg p-3 space-y-1.5 text-foreground">
                  <li><span className="text-muted-foreground">Mode:</span> <span className="font-semibold">{mode === "manual" ? "Manual" : mode === "batch" ? "Batch Input" : "Upload CSV"}</span></li>
                  <li><span className="text-muted-foreground">Kelas:</span> <span className="font-semibold">{kelas || "-"}</span></li>
                  <li><span className="text-muted-foreground">Mata Pelajaran:</span> <span className="font-semibold">{mapel || "-"}</span></li>
                  <li><span className="text-muted-foreground">Jenis Penilaian:</span> <span className="font-semibold">{jenis ? getJenisLabel(jenis) : "-"}</span></li>
                  {showNamaPenilaian && (
                    <li><span className="text-muted-foreground">Nama Penilaian:</span> <span className="font-semibold">{namaPenilaian || jenis}</span></li>
                  )}
                  <li><span className="text-muted-foreground">KKM:</span> <span className="font-semibold">{kkm}{autoKkm ? " (auto-adjust aktif)" : ""}</span></li>
                  <li><span className="text-muted-foreground">Jumlah Nilai:</span> <span className="font-semibold text-primary">{filledCount} dari {students.length} siswa</span></li>
                </ul>
                <p className="text-xs text-muted-foreground pt-1">Pastikan data sudah benar. Lanjutkan menyimpan?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSave} disabled={saving}>
              {saving ? "Menyimpan..." : "Ya, Simpan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
