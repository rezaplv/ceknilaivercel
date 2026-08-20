
-- Ranking settings table (per kelas + mapel)
CREATE TABLE IF NOT EXISTS public.ranking_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kelas_id uuid NOT NULL REFERENCES public.kelas(id) ON DELETE CASCADE,
  mapel_id uuid NOT NULL REFERENCES public.mapel(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kelas_id, mapel_id)
);

GRANT SELECT ON public.ranking_settings TO authenticated;
GRANT ALL ON public.ranking_settings TO service_role;

ALTER TABLE public.ranking_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read ranking_settings"
  ON public.ranking_settings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admin and Guru can insert ranking_settings"
  ON public.ranking_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'ADMIN'::app_role)
    OR public.has_role(auth.uid(), 'GURU'::app_role)
  );

CREATE POLICY "Admin and Guru can update ranking_settings"
  ON public.ranking_settings FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'ADMIN'::app_role)
    OR public.has_role(auth.uid(), 'GURU'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'ADMIN'::app_role)
    OR public.has_role(auth.uid(), 'GURU'::app_role)
  );

CREATE POLICY "Admin can delete ranking_settings"
  ON public.ranking_settings FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- Top ranking function: returns top 3 (dense rank, ties allowed)
CREATE OR REPLACE FUNCTION public.get_top_ranking(
  _kelas_id uuid,
  _mapel_id uuid,
  _jenis text,
  _nama_penilaian text
)
RETURNS TABLE (
  rank integer,
  nama_lengkap text,
  nilai numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_is_guru_of_pair boolean;
  v_is_siswa_of_kelas boolean;
  v_enabled boolean;
BEGIN
  IF _jenis NOT IN ('SUMATIF', 'STS', 'SAS') THEN
    RETURN;
  END IF;

  v_is_admin := public.has_role(auth.uid(), 'ADMIN'::app_role);

  v_is_guru_of_pair := EXISTS (
    SELECT 1
    FROM public.user_kelas uk
    JOIN public.user_mapel um ON um.user_id = uk.user_id
    WHERE uk.user_id = auth.uid()
      AND uk.kelas_id = _kelas_id
      AND um.mapel_id = _mapel_id
      AND public.has_role(auth.uid(), 'GURU'::app_role)
  );

  v_is_siswa_of_kelas := EXISTS (
    SELECT 1 FROM public.user_kelas
    WHERE user_id = auth.uid() AND kelas_id = _kelas_id
  );

  IF NOT (v_is_admin OR v_is_guru_of_pair OR v_is_siswa_of_kelas) THEN
    RETURN;
  END IF;

  SELECT COALESCE(rs.enabled, false) INTO v_enabled
  FROM public.ranking_settings rs
  WHERE rs.kelas_id = _kelas_id AND rs.mapel_id = _mapel_id;

  -- Siswa hanya boleh melihat ketika ranking diaktifkan
  IF NOT v_is_admin AND NOT v_is_guru_of_pair AND NOT COALESCE(v_enabled, false) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH ranked AS (
    SELECT
      p.nama_lengkap,
      COALESCE(s.nilai_asli, s.nilai)::numeric AS nilai_efektif,
      DENSE_RANK() OVER (ORDER BY COALESCE(s.nilai_asli, s.nilai) DESC) AS dr
    FROM public.scores s
    JOIN public.profiles p ON p.user_id = s.student_id
    WHERE s.kelas_id = _kelas_id
      AND s.mapel_id = _mapel_id
      AND s.jenis = _jenis
      AND s.nama_penilaian = _nama_penilaian
      AND s.nilai_type <> 'ceklis'
      AND COALESCE(s.nilai_asli, s.nilai) >= 0
  )
  SELECT dr::int AS rank, ranked.nama_lengkap, ranked.nilai_efektif AS nilai
  FROM ranked
  WHERE dr <= 3
  ORDER BY dr ASC, ranked.nama_lengkap ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_top_ranking(uuid, uuid, text, text) TO authenticated;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_ranking_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ranking_settings_updated_at ON public.ranking_settings;
CREATE TRIGGER trg_ranking_settings_updated_at
BEFORE UPDATE ON public.ranking_settings
FOR EACH ROW EXECUTE FUNCTION public.update_ranking_settings_updated_at();
