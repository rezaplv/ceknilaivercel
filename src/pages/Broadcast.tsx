import { useState, useEffect } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuth } from "@/contexts/AuthContext";
import { Megaphone, Plus, Trash2, Users } from "lucide-react";
import { fetchBroadcasts, insertBroadcast, deleteBroadcast, fetchKelasList, fetchMapelList } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function Broadcast() {
  const { user } = useAuth();
  const { toast } = useToast();
  usePageTitle("Pengumuman");
  const [showForm, setShowForm] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [kelasList, setKelasList] = useState<{ id: string; nama: string }[]>([]);
  const [mapelList, setMapelList] = useState<{ id: string; nama: string }[]>([]);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targetKelas, setTargetKelas] = useState<string[]>([]);
  const [targetMapel, setTargetMapel] = useState<string[]>([]);
  const [targetRole, setTargetRole] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    const [broadcasts, kelas, mapel] = await Promise.all([
      fetchBroadcasts(),
      fetchKelasList(),
      fetchMapelList(),
    ]);
    setItems(broadcasts);
    setKelasList(kelas);
    setMapelList(mapel);
  };

  useEffect(() => {
    loadData();
  }, []);

  if (!user || user.role === "SISWA") return null;

  const isAdmin = user.role === "ADMIN";
  const kelasOptions = user.role === "GURU" && user.kelas?.length ? kelasList.filter(k => user.kelas!.includes(k.nama)) : kelasList;
  const mapelOptions = user.role === "GURU" && user.mapel?.length ? mapelList.filter(m => user.mapel!.includes(m.nama)) : mapelList;

  const toggleKelas = (id: string) => setTargetKelas((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const toggleMapel = (id: string) => setTargetMapel((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const toggleRole = (role: string) => setTargetRole((prev) => prev.includes(role) ? prev.filter((x) => x !== role) : [...prev, role]);

  const handleSubmit = async () => {
    if (!title.trim() || !message.trim() || submitting) return;
    setSubmitting(true);
    try {
      await insertBroadcast({
        title: title.trim(),
        message: message.trim(),
        target_kelas: targetKelas,
        target_mapel: targetMapel,
        target_role: targetRole,
        created_by: user.user_id,
      });
      setTitle("");
      setMessage("");
      setTargetKelas([]);
      setTargetMapel([]);
      setTargetRole([]);
      setShowForm(false);
      toast({ title: "Berhasil", description: "Pengumuman berhasil dikirim" });
      loadData();
    } catch {
      toast({ title: "Error", description: "Gagal mengirim pengumuman", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteBroadcast(id);
    toast({ title: "Dihapus", description: "Pengumuman berhasil dihapus" });
    loadData();
  };

  const formatTarget = (b: any) => {
    const roles = !b.target_role || b.target_role.length === 0
      ? "Semua"
      : b.target_role.join(", ");
    const kelas = !b.target_kelas || b.target_kelas.length === 0
      ? "Semua Kelas"
      : (b.target_kelas_names || b.target_kelas).join(", ");
    const mapel = !b.target_mapel || b.target_mapel.length === 0
      ? "Semua Mapel"
      : (b.target_mapel_names || b.target_mapel).join(", ");
    return `${roles} · ${kelas} · ${mapel}`;
  };

  // Guru only sees their own broadcasts; Admin sees all
  const displayItems = user.role === "GURU"
    ? items.filter((b) => b.created_by === user.user_id)
    : items;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 flex items-center justify-center shadow-md shadow-orange-500/40">
              <Megaphone className="w-5 h-5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">Broadcast</h2>
          </div>
          <p className="text-sm text-foreground/70 mt-2.5 pl-3 border-l-[3px] border-primary font-medium">
            Kelola pengumuman untuk guru dan siswa
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all shadow-md"
        >
          <Plus className="w-4 h-4" />
          Buat Pengumuman
        </button>
      </div>

      {showForm && (
        <div className="bg-card border rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Judul</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm" placeholder="Judul pengumuman" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Pesan</label>
            <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm resize-none" placeholder="Isi pengumuman..." />
          </div>

          {/* Target Role - only for Admin */}
          {isAdmin && (
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                <Users className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                Target Akun <span className="normal-case font-normal">(kosong = semua akun)</span>
              </label>
              <div className="flex flex-wrap gap-2 mt-1">
                {["GURU", "SISWA"].map((role) => (
                  <button key={role} onClick={() => toggleRole(role)} className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${targetRole.includes(role) ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                    {role}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Show kelas/mapel filters only when SISWA is targeted or no role filter */}
          {(!isAdmin || targetRole.length === 0 || targetRole.includes("SISWA")) && (
            <>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                  Target Kelas <span className="normal-case font-normal">(kosong = semua kelas)</span>
                </label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {kelasOptions.map((k) => (
                    <button key={k.id} onClick={() => toggleKelas(k.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${targetKelas.includes(k.id) ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                      {k.nama}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                  Target Mapel <span className="normal-case font-normal">(kosong = semua mapel)</span>
                </label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {mapelOptions.map((m) => (
                    <button key={m.id} onClick={() => toggleMapel(m.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${targetMapel.includes(m.id) ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                      {m.nama}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <button onClick={handleSubmit} disabled={submitting} className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting ? "Mengirim..." : "Kirim Pengumuman"}
          </button>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-muted-foreground">
          Riwayat Pengumuman
        </h3>
        {displayItems.map((b) => (
          <div key={b.id} className="bg-card border rounded-xl p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Megaphone className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-1">
              <h4 className="font-semibold break-words">{b.title}</h4>
              <p className="text-sm text-muted-foreground mt-1 break-words whitespace-pre-wrap">{b.message}</p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-2 text-xs text-muted-foreground">
                <span className="break-words">Target: {formatTarget(b)}</span>
                <span className="break-words">oleh {b.profiles?.username || "unknown"}</span>
                <span className="shrink-1">{new Date(b.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
              </div>
            </div>
            {(isAdmin || b.created_by === user.user_id) && (
              <button onClick={() => handleDelete(b.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors" title="Hapus pengumuman">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        {displayItems.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Belum ada pengumuman</p>
        )}
      </div>
    </div>
  );
}
