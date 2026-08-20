
-- Drop the restrictive SELECT policy and recreate as permissive
DROP POLICY IF EXISTS "Users can read relevant broadcasts" ON public.broadcasts;

CREATE POLICY "Users can read relevant broadcasts"
ON public.broadcasts FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'ADMIN'::app_role)
  OR has_role(auth.uid(), 'GURU'::app_role)
  OR (
    (target_kelas IS NULL OR target_kelas = '{}'::uuid[] OR target_kelas && ARRAY(SELECT kelas_id FROM user_kelas WHERE user_id = auth.uid()))
    AND
    (target_mapel IS NULL OR target_mapel = '{}'::uuid[] OR target_mapel && ARRAY(SELECT mapel_id FROM user_mapel WHERE user_id = auth.uid()))
  )
);

-- Also fix INSERT, UPDATE, DELETE to be permissive
DROP POLICY IF EXISTS "Guru and Admin can insert broadcasts" ON public.broadcasts;
CREATE POLICY "Guru and Admin can insert broadcasts"
ON public.broadcasts FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'GURU'::app_role));

DROP POLICY IF EXISTS "Admin can delete broadcasts" ON public.broadcasts;
CREATE POLICY "Admin can delete broadcasts"
ON public.broadcasts FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'ADMIN'::app_role) OR created_by = auth.uid());

DROP POLICY IF EXISTS "Admin or creator can update broadcasts" ON public.broadcasts;
CREATE POLICY "Admin or creator can update broadcasts"
ON public.broadcasts FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'ADMIN'::app_role) OR created_by = auth.uid());
