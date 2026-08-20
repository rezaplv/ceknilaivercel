
-- Fix 1: Restrict profiles SELECT to own profile, admin, or guru
DROP POLICY IF EXISTS "Authenticated can read profiles" ON public.profiles;

CREATE POLICY "Users can read relevant profiles"
  ON public.profiles
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR has_role(auth.uid(), 'ADMIN'::app_role)
    OR has_role(auth.uid(), 'GURU'::app_role)
  );

-- Fix 2: Restrict scores SELECT so guru can only see scores in their assigned kelas/mapel
DROP POLICY IF EXISTS "Students can read own scores" ON public.scores;

CREATE POLICY "Users can read authorized scores"
  ON public.scores
  FOR SELECT
  USING (
    student_id = auth.uid()
    OR has_role(auth.uid(), 'ADMIN'::app_role)
    OR (
      has_role(auth.uid(), 'GURU'::app_role)
      AND kelas_id IN (SELECT uk.kelas_id FROM public.user_kelas uk WHERE uk.user_id = auth.uid())
      AND mapel_id IN (SELECT um.mapel_id FROM public.user_mapel um WHERE um.user_id = auth.uid())
    )
  );
