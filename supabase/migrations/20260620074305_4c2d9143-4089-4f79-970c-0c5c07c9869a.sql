CREATE OR REPLACE FUNCTION public.get_top_ranking(_kelas_id uuid, _mapel_id uuid, _jenis text, _nama_penilaian text)
 RETURNS TABLE(rank integer, nama_lengkap text, nilai numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      AND COALESCE(s.nilai_asli, s.nilai) >= 80
  )
  SELECT dr::int AS rank, ranked.nama_lengkap, ranked.nilai_efektif AS nilai
  FROM ranked
  WHERE dr <= 3
  ORDER BY dr ASC, ranked.nama_lengkap ASC;
END;
$function$;