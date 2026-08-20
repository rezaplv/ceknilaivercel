import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useBackupNotifications() {
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel("backup-notifications")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "backup_logs",
            filter: `queued_by=eq.${user.id}`,
          },
          (payload) => {
            const log = payload.new as any;
            if (seenIds.current.has(log.id)) return;
            seenIds.current.add(log.id);

            const kelasMapel = `${log.kelas_nama ?? "Kelas"} — ${log.mapel_nama ?? "Mapel"}`;

            if (log.status === "success") {
              toast.success("Backup selesai", {
                description: kelasMapel,
                duration: 6000,
                action: log.drive_file_id
                  ? {
                      label: "Buka Drive",
                      onClick: () => window.open(`https://drive.google.com/file/d/${log.drive_file_id}/view`, "_blank"),
                    }
                  : undefined,
              });
            } else if (log.status === "error") {
              toast.error("Backup gagal", {
                description: `${kelasMapel}. ${log.error_message ?? "Terjadi kesalahan saat backup ke Google Drive."}`,
                duration: 8000,
              });
            } else if (log.status === "skipped") {
              toast.info("Backup dilewati", {
                description: `${kelasMapel}. ${log.error_message ?? "Tidak ada data siswa untuk dibackup."}`,
                duration: 5000,
              });
            }
          }
        )
        .subscribe();
    };

    setup();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);
}
