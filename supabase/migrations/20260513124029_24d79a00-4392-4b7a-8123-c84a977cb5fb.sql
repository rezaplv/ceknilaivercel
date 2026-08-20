-- Tambah kolom queued_by ke backup_logs supaya bisa notifikasi ke user yang mengantrekan
ALTER TABLE public.backup_logs ADD COLUMN IF NOT EXISTS queued_by uuid;

-- Index untuk performa query realtime
CREATE INDEX IF NOT EXISTS idx_backup_logs_queued_by ON public.backup_logs(queued_by);
CREATE INDEX IF NOT EXISTS idx_backup_logs_created_at ON public.backup_logs(created_at DESC);