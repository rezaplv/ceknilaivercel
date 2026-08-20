ALTER TABLE public.kelas ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.kelas ADD COLUMN IF NOT EXISTS archived_by uuid;
ALTER TABLE public.mapel ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.mapel ADD COLUMN IF NOT EXISTS archived_by uuid;
CREATE INDEX IF NOT EXISTS idx_kelas_archived_at ON public.kelas(archived_at);
CREATE INDEX IF NOT EXISTS idx_mapel_archived_at ON public.mapel(archived_at);