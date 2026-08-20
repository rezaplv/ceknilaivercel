import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "kelas" | "mapel";
  id: string;
  nama: string;
  onConfirm: () => Promise<void> | void;
}

interface Usage {
  siswa: number;
  guru: number;
  nilai: number;
}

export default function DeleteKelasMapelDialog({ open, onOpenChange, type, id, nama, onConfirm }: Props) {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) {
      setUsage(null);
      setConfirmText("");
      setDeleting(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        if (type === "kelas") {
          const [{ data: uk }, { count: nilaiCount }] = await Promise.all([
            supabase.from("user_kelas").select("user_id").eq("kelas_id", id),
            supabase.from("scores").select("*", { count: "exact", head: true }).eq("kelas_id", id),
          ]);
          const userIds = (uk ?? []).map((r: any) => r.user_id);
          let siswa = 0, guru = 0;
          if (userIds.length > 0) {
            const { data: roles } = await supabase
              .from("user_roles").select("user_id, role").in("user_id", userIds);
            (roles ?? []).forEach((r: any) => {
              if (r.role === "SISWA") siswa++;
              else if (r.role === "GURU") guru++;
            });
          }
          setUsage({ siswa, guru, nilai: nilaiCount ?? 0 });
        } else {
          const [{ data: um }, { count: nilaiCount }] = await Promise.all([
            supabase.from("user_mapel").select("user_id").eq("mapel_id", id),
            supabase.from("scores").select("*", { count: "exact", head: true }).eq("mapel_id", id),
          ]);
          const userIds = (um ?? []).map((r: any) => r.user_id);
          let guru = 0;
          if (userIds.length > 0) {
            const { data: roles } = await supabase
              .from("user_roles").select("user_id, role").in("user_id", userIds).eq("role", "GURU");
            guru = (roles ?? []).length;
          }
          setUsage({ siswa: 0, guru, nilai: nilaiCount ?? 0 });
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [open, type, id]);

  const totalImpact = (usage?.siswa ?? 0) + (usage?.guru ?? 0) + (usage?.nilai ?? 0);
  const isCritical = totalImpact > 0;
  const requireTyping = isCritical;
  const canDelete = !requireTyping || confirmText.trim().toUpperCase() === "HAPUS";

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setDeleting(false);
    }
  };

  const label = type === "kelas" ? "Kelas" : "Mata Pelajaran";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Hapus {label} "{nama}"?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 pt-2">
              {loading || !usage ? (
                <div className="flex items-center gap-2 text-muted-foreground py-4">
                  <Loader2 className="w-4 h-4 animate-spin" /> Memeriksa data terkait...
                </div>
              ) : (
                <>
                  <p>
                    {label} ini akan dihapus permanen dari sistem.
                    {isCritical && " Penghapusan akan berdampak pada data berikut:"}
                  </p>
                  {isCritical && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm space-y-1.5">
                      {type === "kelas" && usage.siswa > 0 && (
                        <p>• <strong>{usage.siswa} siswa</strong> akan kehilangan kelasnya</p>
                      )}
                      {usage.guru > 0 && (
                        <p>• <strong>{usage.guru} guru</strong> akan kehilangan tugas pada {label.toLowerCase()} ini</p>
                      )}
                      {usage.nilai > 0 && (
                        <p>• <strong>{usage.nilai} data nilai</strong> akan menjadi orphan / tidak dapat diakses</p>
                      )}
                    </div>
                  )}
                  {!isCritical && (
                    <div className="rounded-md border border-border bg-muted/50 p-3 text-sm">
                      ✅ Tidak ada siswa, guru, atau nilai yang terkait. Aman untuk dihapus.
                    </div>
                  )}
                  <p className="text-destructive font-medium">
                    Tindakan ini <strong>tidak dapat dibatalkan</strong>.
                  </p>
                  {requireTyping && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">
                        Untuk konfirmasi, ketik <code className="px-1 py-0.5 bg-muted rounded">HAPUS</code> di bawah:
                      </label>
                      <input
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-destructive"
                        placeholder="Ketik HAPUS"
                        autoFocus
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleConfirm(); }}
            disabled={!canDelete || loading || deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            {deleting ? "Menghapus..." : `Ya, Hapus ${label}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
