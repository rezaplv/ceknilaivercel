-- Enable extensions for scheduled backups
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Backup queue: 1 row per kelas+mapel that needs backup
CREATE TABLE public.backup_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kelas_id uuid NOT NULL,
  mapel_id uuid NOT NULL,
  queued_at timestamptz NOT NULL DEFAULT now(),
  queued_by uuid,
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  UNIQUE (kelas_id, mapel_id)
);

CREATE INDEX idx_backup_queue_queued_at ON public.backup_queue (queued_at);

ALTER TABLE public.backup_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guru and Admin can enqueue backup"
  ON public.backup_queue FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'GURU'::app_role));

CREATE POLICY "Guru and Admin can update queue"
  ON public.backup_queue FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'GURU'::app_role));

CREATE POLICY "Admin can read queue"
  ON public.backup_queue FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'GURU'::app_role));

CREATE POLICY "Admin can delete queue"
  ON public.backup_queue FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'ADMIN'::app_role));

-- Backup logs
CREATE TABLE public.backup_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kelas_id uuid,
  mapel_id uuid,
  kelas_nama text,
  mapel_nama text,
  status text NOT NULL,
  drive_file_id text,
  drive_file_name text,
  error_message text,
  duration_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_backup_logs_created_at ON public.backup_logs (created_at DESC);

ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read backup logs"
  ON public.backup_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'ADMIN'::app_role));

CREATE POLICY "Admin can delete backup logs"
  ON public.backup_logs FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'ADMIN'::app_role));