-- Fix: broadcasts SELECT policy - filter by target_kelas/target_mapel for students
DROP POLICY "Authenticated can read broadcasts" ON public.broadcasts;

CREATE POLICY "Users can read relevant broadcasts"
  ON public.broadcasts
  FOR SELECT
  TO authenticated
  USING (
    -- Admins and teachers can see all broadcasts
    has_role(auth.uid(), 'ADMIN'::app_role)
    OR has_role(auth.uid(), 'GURU'::app_role)
    -- Students see broadcasts targeted to their class/subject or untargeted ones
    OR (
      (target_kelas IS NULL OR target_kelas = '{}' OR target_kelas && ARRAY(SELECT kelas_id FROM public.user_kelas WHERE user_id = auth.uid()))
      AND
      (target_mapel IS NULL OR target_mapel = '{}' OR target_mapel && ARRAY(SELECT mapel_id FROM public.user_mapel WHERE user_id = auth.uid()))
    )
  );
