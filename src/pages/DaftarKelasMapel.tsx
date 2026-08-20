import { useState, useEffect } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Trash2, School, BookOpen, ClipboardPaste, Archive, RotateCcw } from "lucide-react";
import {
  fetchKelasList, fetchMapelList,
  insertKelas, insertMapel,
  archiveKelas, restoreKelas, deleteKelas,
  archiveMapel, restoreMapel, deleteMapel,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import DeleteKelasMapelDialog from "@/components/DeleteKelasMapelDialog";

type Item = { id: string; nama: string; archived_at?: string | null };

export default function DaftarKelasMapel() {
  const { user } = useAuth();
  const { toast } = useToast();
  usePageTitle("Kelas & Mapel");

  const [kelasList, setKelasList] = useState<Item[]>([]);
  const [mapelList, setMapelList] = useState<Item[]>([]);
  const [newKelas, setNewKelas] = useState("");
  const [newMapel, setNewMapel] = useState("");
  const [batchKelas, setBatchKelas] = useState("");
  const [batchMapel, setBatchMapel] = useState("");
  const [loadingKelas, setLoadingKelas] = useState(false);
  const [loadingMapel, setLoadingMapel] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<{ type: "kelas" | "mapel"; id: string; nama: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "kelas" | "mapel"; id: string; nama: string } | null>(null);
  const [bulkArchiveKelasOpen, setBulkArchiveKelasOpen] = useState(false);
  const [bulkArchiving, setBulkArchiving] = useState(false);
  const [bulkArchiveMapelOpen, setBulkArchiveMapelOpen] = useState(false);
  const [bulkArchivingMapel, setBulkArchivingMapel] = useState(false);
  const [bulkDeleteKelasOpen, setBulkDeleteKelasOpen] = useState(false);
  const [bulkDeletingKelas, setBulkDeletingKelas] = useState(false);
  const [bulkDeleteKelasConfirm, setBulkDeleteKelasConfirm] = useState("");
  const [bulkDeleteMapelOpen, setBulkDeleteMapelOpen] = useState(false);
  const [bulkDeletingMapel, setBulkDeletingMapel] = useState(false);
  const [bulkDeleteMapelConfirm, setBulkDeleteMapelConfirm] = useState("");

  const handleBulkArchiveKelas = async () => {
    if (aktifKelas.length === 0) return;
    setBulkArchiving(true);
    let success = 0, failed = 0;
    for (const k of aktifKelas) {
      try { await archiveKelas(k.id); success++; } catch { failed++; }
    }
    setBulkArchiving(false);
    setBulkArchiveKelasOpen(false);
    loadKelasList();
    const parts = [`${success} kelas diarsipkan`];
    if (failed > 0) parts.push(`${failed} gagal`);
    toast({ title: "Arsip Massal", description: parts.join(", ") });
  };

  const handleBulkArchiveMapel = async () => {
    if (aktifMapel.length === 0) return;
    setBulkArchivingMapel(true);
    let success = 0, failed = 0;
    for (const m of aktifMapel) {
      try { await archiveMapel(m.id); success++; } catch { failed++; }
    }
    setBulkArchivingMapel(false);
    setBulkArchiveMapelOpen(false);
    loadMapelList();
    const parts = [`${success} mapel diarsipkan`];
    if (failed > 0) parts.push(`${failed} gagal`);
    toast({ title: "Arsip Massal", description: parts.join(", ") });
  };

  const handleBulkDeleteKelas = async () => {
    if (arsipKelas.length === 0) return;
    setBulkDeletingKelas(true);
    let success = 0, failed = 0, skipped = 0;
    for (const k of arsipKelas) {
      try {
        await deleteKelas(k.id);
        success++;
      } catch {
        failed++;
      }
    }
    setBulkDeletingKelas(false);
    setBulkDeleteKelasOpen(false);
    loadKelasList();
    const parts = [`${success} kelas dihapus permanen`];
    if (failed > 0) parts.push(`${failed} gagal (masih ada relasi data)`);
    toast({ title: "Hapus Permanen Massal", description: parts.join(", "), variant: failed > 0 ? "destructive" : "default" });
  };

  const handleBulkDeleteMapel = async () => {
    if (arsipMapel.length === 0) return;
    setBulkDeletingMapel(true);
    let success = 0, failed = 0;
    for (const m of arsipMapel) {
      try {
        await deleteMapel(m.id);
        success++;
      } catch {
        failed++;
      }
    }
    setBulkDeletingMapel(false);
    setBulkDeleteMapelOpen(false);
    loadMapelList();
    const parts = [`${success} mapel dihapus permanen`];
    if (failed > 0) parts.push(`${failed} gagal (masih ada relasi data)`);
    toast({ title: "Hapus Permanen Massal", description: parts.join(", "), variant: failed > 0 ? "destructive" : "default" });
  };

  const loadKelasList = async () => { setLoadingKelas(true); setKelasList(await fetchKelasList(true) as Item[]); setLoadingKelas(false); };
  const loadMapelList = async () => { setLoadingMapel(true); setMapelList(await fetchMapelList(true) as Item[]); setLoadingMapel(false); };

  useEffect(() => { loadKelasList(); loadMapelList(); }, []);

  if (!user || user.role !== "ADMIN") return null;

  const aktifKelas = kelasList.filter(k => !k.archived_at);
  const arsipKelas = kelasList.filter(k => !!k.archived_at);
  const aktifMapel = mapelList.filter(m => !m.archived_at);
  const arsipMapel = mapelList.filter(m => !!m.archived_at);

  const handleAddKelas = async () => {
    const nama = newKelas.trim();
    if (!nama) return;
    if (aktifKelas.some(k => k.nama.toLowerCase() === nama.toLowerCase())) {
      toast({ title: "Error", description: "Kelas sudah terdaftar", variant: "destructive" });
      return;
    }
    try {
      await insertKelas(nama);
      setNewKelas("");
      loadKelasList();
      toast({ title: "Berhasil", description: `Kelas "${nama}" berhasil ditambahkan` });
    } catch {
      toast({ title: "Error", description: "Gagal menambahkan kelas", variant: "destructive" });
    }
  };

  const handleBatchKelas = async () => {
    const lines = batchKelas.split(/[\n,;]+/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    const existingNames = new Set(aktifKelas.map(k => k.nama.toLowerCase()));
    const unique = [...new Set(lines)].filter(l => !existingNames.has(l.toLowerCase()));
    const duplicates = lines.length - unique.length;
    if (unique.length === 0) {
      toast({ title: "Info", description: "Semua kelas sudah terdaftar", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    let success = 0, failed = 0;
    for (const nama of unique) {
      try { await insertKelas(nama); success++; } catch { failed++; }
    }
    setSubmitting(false);
    setBatchKelas("");
    loadKelasList();
    const parts = [`${success} kelas berhasil ditambahkan`];
    if (duplicates > 0) parts.push(`${duplicates} sudah ada`);
    if (failed > 0) parts.push(`${failed} gagal`);
    toast({ title: "Batch Kelas", description: parts.join(", ") });
  };

  const handleArchiveKelas = async (id: string, nama: string) => {
    try {
      await archiveKelas(id);
      loadKelasList();
      toast({ title: "Diarsipkan", description: `Kelas "${nama}" dipindahkan ke Arsip. Data nilai tetap utuh & dapat dipulihkan.` });
    } catch {
      toast({ title: "Error", description: "Gagal mengarsipkan kelas", variant: "destructive" });
    }
  };

  const handleRestoreKelas = async (id: string, nama: string) => {
    try {
      await restoreKelas(id);
      loadKelasList();
      toast({ title: "Dipulihkan", description: `Kelas "${nama}" berhasil dipulihkan` });
    } catch {
      toast({ title: "Error", description: "Gagal memulihkan kelas", variant: "destructive" });
    }
  };

  const handleDeleteKelasPermanent = async (id: string, nama: string) => {
    try {
      await deleteKelas(id);
      loadKelasList();
      toast({ title: "Dihapus permanen", description: `Kelas "${nama}" berhasil dihapus permanen` });
    } catch {
      toast({ title: "Error", description: "Gagal menghapus kelas. Pastikan tidak ada user yang menggunakan kelas ini.", variant: "destructive" });
    }
  };

  const handleAddMapel = async () => {
    const nama = newMapel.trim();
    if (!nama) return;
    if (aktifMapel.some(m => m.nama.toLowerCase() === nama.toLowerCase())) {
      toast({ title: "Error", description: "Mapel sudah terdaftar", variant: "destructive" });
      return;
    }
    try {
      await insertMapel(nama);
      setNewMapel("");
      loadMapelList();
      toast({ title: "Berhasil", description: `Mapel "${nama}" berhasil ditambahkan` });
    } catch {
      toast({ title: "Error", description: "Gagal menambahkan mapel", variant: "destructive" });
    }
  };

  const handleBatchMapel = async () => {
    const lines = batchMapel.split(/[\n,;]+/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    const existingNames = new Set(aktifMapel.map(m => m.nama.toLowerCase()));
    const unique = [...new Set(lines)].filter(l => !existingNames.has(l.toLowerCase()));
    const duplicates = lines.length - unique.length;
    if (unique.length === 0) {
      toast({ title: "Info", description: "Semua mapel sudah terdaftar", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    let success = 0, failed = 0;
    for (const nama of unique) {
      try { await insertMapel(nama); success++; } catch { failed++; }
    }
    setSubmitting(false);
    setBatchMapel("");
    loadMapelList();
    const parts = [`${success} mapel berhasil ditambahkan`];
    if (duplicates > 0) parts.push(`${duplicates} sudah ada`);
    if (failed > 0) parts.push(`${failed} gagal`);
    toast({ title: "Batch Mapel", description: parts.join(", ") });
  };

  const handleArchiveMapel = async (id: string, nama: string) => {
    try {
      await archiveMapel(id);
      loadMapelList();
      toast({ title: "Diarsipkan", description: `Mapel "${nama}" dipindahkan ke Arsip. Data nilai tetap utuh & dapat dipulihkan.` });
    } catch {
      toast({ title: "Error", description: "Gagal mengarsipkan mapel", variant: "destructive" });
    }
  };

  const handleRestoreMapel = async (id: string, nama: string) => {
    try {
      await restoreMapel(id);
      loadMapelList();
      toast({ title: "Dipulihkan", description: `Mapel "${nama}" berhasil dipulihkan` });
    } catch {
      toast({ title: "Error", description: "Gagal memulihkan mapel", variant: "destructive" });
    }
  };

  const handleDeleteMapelPermanent = async (id: string, nama: string) => {
    try {
      await deleteMapel(id);
      loadMapelList();
      toast({ title: "Dihapus permanen", description: `Mapel "${nama}" berhasil dihapus permanen` });
    } catch {
      toast({ title: "Error", description: "Gagal menghapus mapel. Pastikan tidak ada user yang menggunakan mapel ini.", variant: "destructive" });
    }
  };

  const inputClass = "w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="space-y-4 sm:space-y-6 max-w-4xl">
      <div>
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 flex items-center justify-center shadow-md shadow-orange-500/40 shrink-0">
            <School className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-foreground">Daftar Kelas & Mata Pelajaran</h2>
        </div>
        <p className="text-xs sm:text-sm text-foreground/70 mt-2 sm:mt-2.5 pl-3 border-l-[3px] border-primary font-medium">
          Kelola data kelas dan mata pelajaran. Penghapusan akan masuk ke <strong>Arsip</strong> dan dapat dipulihkan kembali.
        </p>
      </div>

      {/* Kelas Management */}
      <div className="bg-card border rounded-xl p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <School className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Daftar Kelas</h3>
        </div>

        <Tabs defaultValue="satuan" className="w-full">
          <TabsList className="mb-3 h-auto flex-wrap">
            <TabsTrigger value="satuan" className="gap-1.5"><Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Satuan</span><span className="sm:hidden">Satu</span></TabsTrigger>
            <TabsTrigger value="batch" className="gap-1.5"><ClipboardPaste className="w-3.5 h-3.5" /> Batch</TabsTrigger>
          </TabsList>
          <TabsContent value="satuan">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={newKelas}
                onChange={(e) => setNewKelas(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddKelas()}
                className={inputClass}
                placeholder="Nama kelas baru, misal: X-A"
              />
              <button onClick={handleAddKelas} className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all shadow-md flex items-center justify-center gap-1.5 whitespace-nowrap">
                <Plus className="w-4 h-4" /> Tambah
              </button>
            </div>
          </TabsContent>
          <TabsContent value="batch">
            <div className="space-y-2">
              <textarea
                value={batchKelas}
                onChange={(e) => setBatchKelas(e.target.value)}
                className={`${inputClass} min-h-[100px] resize-y`}
                placeholder={"Paste daftar kelas, pisahkan dengan enter, koma, atau titik koma.\nContoh:\nX-A\nX-B\nXI-IPA 1, XI-IPA 2"}
              />
              <button
                onClick={handleBatchKelas}
                disabled={submitting || !batchKelas.trim()}
                className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all shadow-md flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-50"
              >
                <ClipboardPaste className="w-4 h-4" /> {submitting ? "Memproses..." : "Tambah Batch"}
              </button>
            </div>
          </TabsContent>
        </Tabs>

        <Tabs defaultValue="aktif" className="w-full pt-2">
          <TabsList>
            <TabsTrigger value="aktif">Aktif ({aktifKelas.length})</TabsTrigger>
            <TabsTrigger value="arsip" className="gap-1.5"><Archive className="w-3.5 h-3.5" /> Arsip ({arsipKelas.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="aktif">
            <div className="flex flex-wrap gap-2 pt-2">
              {loadingKelas ? <p className="text-sm text-muted-foreground">Memuat...</p> :
                aktifKelas.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada kelas terdaftar</p> :
                aktifKelas.map((k) => (
                  <div key={k.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-sm font-medium">
                    {k.nama}
                    <button
                      onClick={() => setArchiveTarget({ type: "kelas", id: k.id, nama: k.nama })}
                      className="p-0.5 rounded hover:bg-amber-500/10 text-amber-600/70 hover:text-amber-600 transition-colors"
                      title="Arsipkan"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              }
            </div>
            {aktifKelas.length > 0 && (
              <div className="flex justify-start sm:justify-end pt-3">
                <button
                  onClick={() => setBulkArchiveKelasOpen(true)}
                  disabled={bulkArchiving}
                  className="w-full sm:w-auto px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 text-xs sm:text-sm font-semibold hover:bg-amber-500/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Archive className="w-4 h-4" />
                  Arsipkan Semua Kelas
                </button>
              </div>
            )}
          </TabsContent>
          <TabsContent value="arsip">
            <div className="flex flex-wrap gap-2 pt-2">
              {arsipKelas.length === 0 ? <p className="text-sm text-muted-foreground">Arsip kosong</p> :
                arsipKelas.map((k) => (
                  <div key={k.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm font-medium">
                    <span className="text-muted-foreground line-through">{k.nama}</span>
                    <button
                      onClick={() => handleRestoreKelas(k.id, k.nama)}
                      className="p-0.5 rounded hover:bg-green-500/10 text-green-600 transition-colors"
                      title="Pulihkan"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ type: "kelas", id: k.id, nama: k.nama })}
                      className="p-0.5 rounded hover:bg-destructive/10 text-destructive/70 hover:text-destructive transition-colors"
                      title="Hapus permanen"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              }
            </div>
            {arsipKelas.length > 0 && (
              <div className="flex justify-start sm:justify-end pt-3">
                <button
                  onClick={() => setBulkDeleteKelasOpen(true)}
                  disabled={bulkDeletingKelas}
                  className="w-full sm:w-auto px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs sm:text-sm font-semibold hover:bg-destructive/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Hapus Semua Kelas
                </button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Mapel Management */}
      <div className="bg-card border rounded-xl p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Daftar Mata Pelajaran</h3>
        </div>

        <Tabs defaultValue="satuan" className="w-full">
          <TabsList className="mb-3 h-auto flex-wrap">
            <TabsTrigger value="satuan" className="gap-1.5"><Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Satuan</span><span className="sm:hidden">Satu</span></TabsTrigger>
            <TabsTrigger value="batch" className="gap-1.5"><ClipboardPaste className="w-3.5 h-3.5" /> Batch</TabsTrigger>
          </TabsList>
          <TabsContent value="satuan">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={newMapel}
                onChange={(e) => setNewMapel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddMapel()}
                className={inputClass}
                placeholder="Nama mapel baru, misal: Matematika"
              />
              <button onClick={handleAddMapel} className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all shadow-md flex items-center justify-center gap-1.5 whitespace-nowrap">
                <Plus className="w-4 h-4" /> Tambah
              </button>
            </div>
          </TabsContent>
          <TabsContent value="batch">
            <div className="space-y-2">
              <textarea
                value={batchMapel}
                onChange={(e) => setBatchMapel(e.target.value)}
                className={`${inputClass} min-h-[100px] resize-y`}
                placeholder={"Paste daftar mapel, pisahkan dengan enter, koma, atau titik koma.\nContoh:\nMatematika\nBahasa Indonesia\nFisika, Kimia, Biologi"}
              />
              <button
                onClick={handleBatchMapel}
                disabled={submitting || !batchMapel.trim()}
                className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all shadow-md flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-50"
              >
                <ClipboardPaste className="w-4 h-4" /> {submitting ? "Memproses..." : "Tambah Batch"}
              </button>
            </div>
          </TabsContent>
        </Tabs>

        <Tabs defaultValue="aktif" className="w-full pt-2">
          <TabsList>
            <TabsTrigger value="aktif">Aktif ({aktifMapel.length})</TabsTrigger>
            <TabsTrigger value="arsip" className="gap-1.5"><Archive className="w-3.5 h-3.5" /> Arsip ({arsipMapel.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="aktif">
            <div className="flex flex-wrap gap-2 pt-2">
              {loadingMapel ? <p className="text-sm text-muted-foreground">Memuat...</p> :
                aktifMapel.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada mapel terdaftar</p> :
                aktifMapel.map((m) => (
                  <div key={m.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-sm font-medium">
                    {m.nama}
                    <button
                      onClick={() => setArchiveTarget({ type: "mapel", id: m.id, nama: m.nama })}
                      className="p-0.5 rounded hover:bg-amber-500/10 text-amber-600/70 hover:text-amber-600 transition-colors"
                      title="Arsipkan"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              }
            </div>
            {aktifMapel.length > 0 && (
              <div className="flex justify-start sm:justify-end pt-3">
                <button
                  onClick={() => setBulkArchiveMapelOpen(true)}
                  disabled={bulkArchivingMapel}
                  className="w-full sm:w-auto px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 text-xs sm:text-sm font-semibold hover:bg-amber-500/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Archive className="w-4 h-4" />
                  Arsipkan Semua Mapel
                </button>
              </div>
            )}
          </TabsContent>
          <TabsContent value="arsip">
            <div className="flex flex-wrap gap-2 pt-2">
              {arsipMapel.length === 0 ? <p className="text-sm text-muted-foreground">Arsip kosong</p> :
                arsipMapel.map((m) => (
                  <div key={m.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm font-medium">
                    <span className="text-muted-foreground line-through">{m.nama}</span>
                    <button
                      onClick={() => handleRestoreMapel(m.id, m.nama)}
                      className="p-0.5 rounded hover:bg-green-500/10 text-green-600 transition-colors"
                      title="Pulihkan"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ type: "mapel", id: m.id, nama: m.nama })}
                      className="p-0.5 rounded hover:bg-destructive/10 text-destructive/70 hover:text-destructive transition-colors"
                      title="Hapus permanen"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              }
            </div>
            {arsipMapel.length > 0 && (
              <div className="flex justify-start sm:justify-end pt-3">
                <button
                  onClick={() => setBulkDeleteMapelOpen(true)}
                  disabled={bulkDeletingMapel}
                  className="w-full sm:w-auto px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs sm:text-sm font-semibold hover:bg-destructive/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Hapus Semua Mapel
                </button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Archive (soft-delete) confirmation */}
      <AlertDialog open={!!archiveTarget} onOpenChange={(o) => { if (!o) setArchiveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <Archive className="w-5 h-5" />
              Arsipkan {archiveTarget?.type === "kelas" ? "Kelas" : "Mata Pelajaran"} "{archiveTarget?.nama}"?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 pt-2">
                <p>{archiveTarget?.type === "kelas" ? "Kelas" : "Mapel"} ini akan dipindahkan ke <strong>Arsip</strong>.</p>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  <li>Tidak muncul lagi di daftar aktif & dropdown.</li>
                  <li>Data nilai, siswa, dan guru terkait <strong>tetap utuh</strong>.</li>
                  <li>Dapat <strong>dipulihkan</strong> kapan saja dari tab Arsip.</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!archiveTarget) return;
                if (archiveTarget.type === "kelas") await handleArchiveKelas(archiveTarget.id, archiveTarget.nama);
                else await handleArchiveMapel(archiveTarget.id, archiveTarget.nama);
                setArchiveTarget(null);
              }}
              className="bg-amber-500 text-white hover:bg-amber-600"
            >
              Arsipkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanent delete confirmation (from Arsip tab) */}
      {deleteTarget && (
        <DeleteKelasMapelDialog
          open={!!deleteTarget}
          onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
          type={deleteTarget.type}
          id={deleteTarget.id}
          nama={deleteTarget.nama}
          onConfirm={async () => {
            if (deleteTarget.type === "kelas") await handleDeleteKelasPermanent(deleteTarget.id, deleteTarget.nama);
            else await handleDeleteMapelPermanent(deleteTarget.id, deleteTarget.nama);
          }}
        />
      )}

      {/* Bulk archive all aktif kelas confirmation */}
      <AlertDialog open={bulkArchiveKelasOpen} onOpenChange={(o) => { if (!o && !bulkArchiving) setBulkArchiveKelasOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <Archive className="w-5 h-5" />
              Arsipkan Semua Kelas Aktif?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 pt-2">
                <p><strong>{aktifKelas.length}</strong> kelas aktif akan dipindahkan ke <strong>Arsip</strong> sekaligus.</p>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  <li>Tidak muncul lagi di daftar aktif & dropdown.</li>
                  <li>Data nilai, siswa, dan guru terkait <strong>tetap utuh</strong>.</li>
                  <li>Dapat <strong>dipulihkan</strong> kapan saja dari tab Arsip.</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkArchiving}>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkArchiving}
              onClick={(e) => { e.preventDefault(); handleBulkArchiveKelas(); }}
              className="bg-amber-500 text-white hover:bg-amber-600"
            >
              {bulkArchiving ? "Mengarsipkan..." : "Arsipkan Semua"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk archive all aktif mapel confirmation */}
      <AlertDialog open={bulkArchiveMapelOpen} onOpenChange={(o) => { if (!o && !bulkArchivingMapel) setBulkArchiveMapelOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <Archive className="w-5 h-5" />
              Arsipkan Semua Mapel Aktif?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 pt-2">
                <p><strong>{aktifMapel.length}</strong> mapel aktif akan dipindahkan ke <strong>Arsip</strong> sekaligus.</p>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  <li>Tidak muncul lagi di daftar aktif & dropdown.</li>
                  <li>Data nilai, siswa, dan guru terkait <strong>tetap utuh</strong>.</li>
                  <li>Dapat <strong>dipulihkan</strong> kapan saja dari tab Arsip.</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkArchivingMapel}>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkArchivingMapel}
              onClick={(e) => { e.preventDefault(); handleBulkArchiveMapel(); }}
              className="bg-amber-500 text-white hover:bg-amber-600"
            >
              {bulkArchivingMapel ? "Mengarsipkan..." : "Arsipkan Semua"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete all arsip kelas confirmation */}
      <AlertDialog open={bulkDeleteKelasOpen} onOpenChange={(o) => { if (!o && !bulkDeletingKelas) { setBulkDeleteKelasOpen(false); setBulkDeleteKelasConfirm(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Hapus Permanen Semua Kelas Arsip?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 pt-2">
                <p><strong>{arsipKelas.length}</strong> kelas di Arsip akan <strong>dihapus permanen</strong> sekaligus.</p>
                <ul className="list-disc pl-5 text-sm space-y-1 text-destructive/90">
                  <li>Tindakan ini <strong>TIDAK DAPAT DIBATALKAN</strong>.</li>
                  <li>Kelas yang masih memiliki siswa atau data nilai akan <strong>gagal dihapus</strong> demi keamanan data.</li>
                  <li>Pastikan Anda sudah membackup data jika diperlukan.</li>
                </ul>
                <div className="pt-2">
                  <label className="text-sm font-medium">Ketik <strong>HAPUS</strong> untuk konfirmasi:</label>
                  <input
                    value={bulkDeleteKelasConfirm}
                    onChange={(e) => setBulkDeleteKelasConfirm(e.target.value)}
                    placeholder="HAPUS"
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-destructive/30 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-destructive/50"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeletingKelas} onClick={() => setBulkDeleteKelasConfirm("")}>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkDeletingKelas || bulkDeleteKelasConfirm !== "HAPUS"}
              onClick={(e) => { e.preventDefault(); handleBulkDeleteKelas(); }}
              className="bg-destructive text-white hover:bg-destructive/90 disabled:opacity-50"
            >
              {bulkDeletingKelas ? "Menghapus..." : "Hapus Permanen Semua"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete all arsip mapel confirmation */}
      <AlertDialog open={bulkDeleteMapelOpen} onOpenChange={(o) => { if (!o && !bulkDeletingMapel) { setBulkDeleteMapelOpen(false); setBulkDeleteMapelConfirm(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Hapus Permanen Semua Mapel Arsip?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 pt-2">
                <p><strong>{arsipMapel.length}</strong> mapel di Arsip akan <strong>dihapus permanen</strong> sekaligus.</p>
                <ul className="list-disc pl-5 text-sm space-y-1 text-destructive/90">
                  <li>Tindakan ini <strong>TIDAK DAPAT DIBATALKAN</strong>.</li>
                  <li>Mapel yang masih memiliki data nilai akan <strong>gagal dihapus</strong> demi keamanan data.</li>
                  <li>Pastikan Anda sudah membackup data jika diperlukan.</li>
                </ul>
                <div className="pt-2">
                  <label className="text-sm font-medium">Ketik <strong>HAPUS</strong> untuk konfirmasi:</label>
                  <input
                    value={bulkDeleteMapelConfirm}
                    onChange={(e) => setBulkDeleteMapelConfirm(e.target.value)}
                    placeholder="HAPUS"
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-destructive/30 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-destructive/50"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeletingMapel} onClick={() => setBulkDeleteMapelConfirm("")}>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkDeletingMapel || bulkDeleteMapelConfirm !== "HAPUS"}
              onClick={(e) => { e.preventDefault(); handleBulkDeleteMapel(); }}
              className="bg-destructive text-white hover:bg-destructive/90 disabled:opacity-50"
            >
              {bulkDeletingMapel ? "Menghapus..." : "Hapus Permanen Semua"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
