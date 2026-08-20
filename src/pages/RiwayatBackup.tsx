import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CloudUpload, RefreshCw, Trash2, ExternalLink, AlertCircle, CheckCircle2, Clock, PlayCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { usePageTitle } from "@/hooks/usePageTitle";

interface BackupLog {
  id: string;
  kelas_nama: string | null;
  mapel_nama: string | null;
  status: string;
  drive_file_id: string | null;
  drive_file_name: string | null;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
}

interface QueueItem {
  id: string;
  kelas_id: string;
  mapel_id: string;
  queued_at: string;
  attempts: number;
  last_error: string | null;
}

interface QueueRow extends QueueItem {
  kelas_nama?: string;
  mapel_nama?: string;
}

export default function RiwayatBackup() {
  usePageTitle("Riwayat Backup");
  const [logs, setLogs] = useState<BackupLog[]>([]);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [logsRes, queueRes, kelasRes, mapelRes] = await Promise.all([
        supabase.from("backup_logs").select("*").order("created_at", { ascending: false }).limit(100),
        (supabase.from("backup_queue") as any).select("*").order("queued_at", { ascending: true }),
        supabase.from("kelas").select("id, nama"),
        supabase.from("mapel").select("id, nama"),
      ]);
      const kelasMap = new Map((kelasRes.data ?? []).map((k: any) => [k.id, k.nama]));
      const mapelMap = new Map((mapelRes.data ?? []).map((m: any) => [m.id, m.nama]));
      setLogs(logsRes.data ?? []);
      setQueue(((queueRes.data ?? []) as QueueItem[]).map((q) => ({
        ...q,
        kelas_nama: kelasMap.get(q.kelas_id) ?? "—",
        mapel_nama: mapelMap.get(q.mapel_id) ?? "—",
      })));
    } catch (e: any) {
      toast.error("Gagal memuat data: " + (e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Realtime: refresh otomatis saat queue/log berubah
  useEffect(() => {
    const ch = supabase
      .channel("backup-rekap-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "backup_queue" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "backup_logs" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const runNow = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("backup-rekap-drive", { body: {} });
      if (error) throw error;
      const summary = data as any;
      if (summary?.ok === false) {
        toast.error(summary.error || "Backup gagal");
      } else {
        toast.success(
          `Backup selesai — sukses: ${summary?.succeeded ?? 0}, gagal: ${summary?.failed ?? 0}, dilewati: ${summary?.skipped ?? 0}`,
        );
      }
      await load();
    } catch (e: any) {
      toast.error("Gagal menjalankan backup: " + (e?.message ?? e));
    } finally {
      setRunning(false);
    }
  };

  const seedExisting = async () => {
    setSeeding(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // Ambil semua pasangan kelas+mapel yang punya score
      const pairs = new Map<string, { kelas_id: string; mapel_id: string }>();
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("scores")
          .select("kelas_id, mapel_id")
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        for (const r of data as any[]) {
          if (r.kelas_id && r.mapel_id) pairs.set(`${r.kelas_id}|${r.mapel_id}`, { kelas_id: r.kelas_id, mapel_id: r.mapel_id });
        }
        if (data.length < pageSize) break;
        from += pageSize;
      }
      if (pairs.size === 0) {
        toast.info("Tidak ada nilai di Rekap untuk dibackup.");
        return;
      }
      const rows = Array.from(pairs.values()).map((p) => ({
        ...p,
        queued_by: user?.id ?? null,
        attempts: 0,
      }));
      const { error: upErr } = await (supabase.from("backup_queue") as any).upsert(rows, {
        onConflict: "kelas_id,mapel_id",
      });
      if (upErr) throw upErr;
      toast.success(`${rows.length} kelas+mapel diantrekan. Cron akan memproses dalam 2 menit, atau klik 'Backup Sekarang'.`);
      await load();
    } catch (e: any) {
      toast.error("Gagal mengantrekan: " + (e?.message ?? e));
    } finally {
      setSeeding(false);
    }
  };

  const clearLogs = async () => {
    const { error } = await supabase.from("backup_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) toast.error(error.message);
    else { toast.success("Riwayat eksekusi berhasil dihapus"); await load(); }
  };

  const statusBadge = (status: string) => {
    if (status === "success") return <Badge className="bg-green-600 hover:bg-green-600 gap-1"><CheckCircle2 className="w-3 h-3" />Sukses</Badge>;
    if (status === "skipped") return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" />Dilewati</Badge>;
    return <Badge variant="destructive" className="gap-1"><AlertCircle className="w-3 h-3" />Gagal</Badge>;
  };

  const succeeded = logs.filter((l) => l.status === "success").length;
  const failed = logs.filter((l) => l.status === "error").length;
  const lastSuccess = logs.find((l) => l.status === "success");

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <CloudUpload className="w-7 h-7 text-primary" />
            Riwayat Backup Google Drive
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Backup otomatis ke Google Drive admin — terpicu saat guru/admin menyimpan nilai, lalu diproses cron tiap 2 menit. Halaman ini auto-update realtime.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="secondary" disabled={seeding}>
                <CloudUpload className={`w-4 h-4 mr-2 ${seeding ? "animate-pulse" : ""}`} />
                {seeding ? "Mengantrekan..." : "Antrekan Data Lama"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <CloudUpload className="w-5 h-5 text-primary" />
                  Antrekan Data Lama
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-2 text-sm">
                    <p>Tombol ini memindai <strong>semua kelas + mapel yang sudah punya nilai</strong> di Rekap Nilai, lalu memasukkannya ke <strong>antrian backup</strong>.</p>
                    <div className="rounded-md bg-muted p-3 space-y-1">
                      <p className="font-semibold text-foreground">Kapan dipakai?</p>
                      <p>Saat pertama kali mengaktifkan fitur backup, atau setelah restore data lama yang belum pernah ter-backup ke Google Drive.</p>
                    </div>
                    <div className="rounded-md bg-muted p-3 space-y-1">
                      <p className="font-semibold text-foreground">Apa yang terjadi?</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        <li>Antrian akan otomatis diproses oleh cron <strong>setiap 2 menit</strong>.</li>
                        <li>Atau klik <strong>“Backup Sekarang”</strong> agar langsung diproses.</li>
                        <li>File lama di Drive akan di-<strong>overwrite</strong> dengan versi terbaru.</li>
                      </ul>
                    </div>
                    <p className="text-muted-foreground">Aman dijalankan kapan saja — tidak menghapus data nilai apapun.</p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={seedExisting}>Ya, Antrekan</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={running}>
                <PlayCircle className={`w-4 h-4 mr-2 ${running ? "animate-pulse" : ""}`} />
                {running ? "Memproses..." : "Backup Sekarang"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <PlayCircle className="w-5 h-5 text-primary" />
                  Backup Sekarang
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-2 text-sm">
                    <p>Tombol ini <strong>langsung memproses semua antrian</strong> backup tanpa menunggu cron 2 menit.</p>
                    <div className="rounded-md bg-muted p-3 space-y-1">
                      <p className="font-semibold text-foreground">Kapan dipakai?</p>
                      <p>Saat butuh hasil backup segera (mis. setelah input nilai final, sebelum tutup rapor) tanpa menunggu jadwal otomatis.</p>
                    </div>
                    <div className="rounded-md bg-muted p-3 space-y-1">
                      <p className="font-semibold text-foreground">Apa yang terjadi?</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        <li>Setiap kelas+mapel di antrian akan diunggah ke folder <code>CekNilai Backup/&lt;Kelas&gt;/</code> di Google Drive.</li>
                        <li>File <code>Rekap_&lt;Kelas&gt;_&lt;Mapel&gt;_ALL.xlsx</code> akan dibuat baru atau di-<strong>overwrite</strong>.</li>
                        <li>Hasil sukses/gagal muncul di tabel Riwayat di bawah.</li>
                      </ul>
                    </div>
                    <p className="text-muted-foreground">Tidak ada data nilai yang berubah — hanya menyalin ke Drive.</p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={runNow}>Ya, Jalankan</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Antrian</p>
            <p className="text-2xl font-bold text-orange-500">{queue.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Sukses (100 terakhir)</p>
            <p className="text-2xl font-bold text-green-600">{succeeded}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Gagal (100 terakhir)</p>
            <p className="text-2xl font-bold text-destructive">{failed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Backup Sukses Terakhir</p>
            <p className="text-sm font-medium">
              {lastSuccess ? new Date(lastSuccess.created_at).toLocaleString("id-ID") : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Queue */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Antrian Backup ({queue.length})</CardTitle>
          <CardDescription>Pasangan kelas+mapel yang menunggu di-backup pada cron berikutnya (maks 2 menit).</CardDescription>
        </CardHeader>
        <CardContent>
          {queue.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Antrian kosong.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kelas</TableHead>
                    <TableHead>Mapel</TableHead>
                    <TableHead>Antri Sejak</TableHead>
                    <TableHead className="text-center">Percobaan</TableHead>
                    <TableHead>Error Terakhir</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queue.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell className="font-medium">{q.kelas_nama}</TableCell>
                      <TableCell>{q.mapel_nama}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(q.queued_at).toLocaleString("id-ID")}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={q.attempts > 0 ? "destructive" : "secondary"}>{q.attempts}/3</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-destructive max-w-xs truncate">{q.last_error ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logs */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Riwayat Eksekusi (100 terakhir)</CardTitle>
            <CardDescription>Log semua backup yang dijalankan, baik sukses maupun gagal.</CardDescription>
          </div>
          {logs.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Hapus Semua
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="w-5 h-5" />
                    Hapus Semua Riwayat Eksekusi?
                  </AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-3 pt-2">
                      <p>
                        Tindakan ini akan menghapus <strong>semua catatan log backup</strong> ({logs.length} entri) dari halaman ini secara permanen.
                      </p>
                      <div className="rounded-md border border-border bg-muted/50 p-3 text-sm space-y-2">
                        <p className="font-semibold text-foreground">⚠️ Yang DIHAPUS:</p>
                        <ul className="list-disc list-inside text-muted-foreground space-y-1">
                          <li>Riwayat waktu eksekusi backup</li>
                          <li>Status sukses/gagal beserta pesan error</li>
                          <li>Tautan ke file Excel di Google Drive</li>
                        </ul>
                        <p className="font-semibold text-foreground pt-1">✅ Yang TIDAK terpengaruh:</p>
                        <ul className="list-disc list-inside text-muted-foreground space-y-1">
                          <li>File Excel di Google Drive (tetap aman)</li>
                          <li>Antrian backup yang sedang berjalan</li>
                          <li>Data nilai siswa di sistem</li>
                        </ul>
                      </div>
                      <p className="text-destructive font-medium">
                        Tindakan ini <strong>tidak dapat dibatalkan</strong>. Audit trail backup akan hilang.
                      </p>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Batal</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={clearLogs}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Ya, Hapus Semua
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Belum ada riwayat backup. Pastikan Google Drive sudah terhubung.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Kelas</TableHead>
                    <TableHead>Mapel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>File / Pesan</TableHead>
                    <TableHead className="text-right">Durasi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(l.created_at).toLocaleString("id-ID")}
                      </TableCell>
                      <TableCell className="font-medium">{l.kelas_nama ?? "—"}</TableCell>
                      <TableCell>{l.mapel_nama ?? "—"}</TableCell>
                      <TableCell>{statusBadge(l.status)}</TableCell>
                      <TableCell className="max-w-md">
                        {l.status === "success" && l.drive_file_id ? (
                          <a
                            href={`https://drive.google.com/file/d/${l.drive_file_id}/view`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-1 text-sm"
                          >
                            {l.drive_file_name ?? "Lihat di Drive"}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-destructive">{l.error_message ?? "—"}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                        {l.duration_ms ? `${l.duration_ms} ms` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
