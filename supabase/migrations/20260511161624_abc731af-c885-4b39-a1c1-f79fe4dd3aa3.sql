
-- 1. Soft-delete kolom di profiles (untuk arsip akun siswa, ADMIN-only)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid;

-- Partial index agar query siswa aktif tetap cepat
CREATE INDEX IF NOT EXISTS idx_profiles_active
  ON public.profiles(user_id) WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_archived
  ON public.profiles(archived_at) WHERE archived_at IS NOT NULL;

-- 2. Tabel arsip nilai untuk recovery per-guru
CREATE TABLE IF NOT EXISTS public.deleted_scores_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deleted_by uuid NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  context text NOT NULL,                -- 'rekap_bulk' | 'rekap_single' | 'rename'
  kelas_id uuid,
  mapel_id uuid,
  jenis text,
  nama_penilaian text,
  payload jsonb NOT NULL,               -- snapshot baris scores yang dihapus (array)
  note text
);

CREATE INDEX IF NOT EXISTS idx_dsa_deleted_by ON public.deleted_scores_archive(deleted_by);
CREATE INDEX IF NOT EXISTS idx_dsa_deleted_at ON public.deleted_scores_archive(deleted_at);

ALTER TABLE public.deleted_scores_archive ENABLE ROW LEVEL SECURITY;

-- GURU hanya melihat arsip miliknya; ADMIN melihat semua
CREATE POLICY "view_own_or_admin"
  ON public.deleted_scores_archive
  FOR SELECT TO authenticated
  USING (deleted_by = auth.uid() OR public.has_role(auth.uid(), 'ADMIN'::app_role));

-- GURU & ADMIN bisa insert (hanya sebagai dirinya sendiri)
CREATE POLICY "insert_self"
  ON public.deleted_scores_archive
  FOR INSERT TO authenticated
  WITH CHECK (
    deleted_by = auth.uid()
    AND (public.has_role(auth.uid(), 'ADMIN'::app_role) OR public.has_role(auth.uid(), 'GURU'::app_role))
  );

-- GURU bisa hapus arsip miliknya (saat restore/purge); ADMIN semua
CREATE POLICY "delete_own_or_admin"
  ON public.deleted_scores_archive
  FOR DELETE TO authenticated
  USING (deleted_by = auth.uid() OR public.has_role(auth.uid(), 'ADMIN'::app_role));
