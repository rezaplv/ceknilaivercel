-- Hapus policy select lama yang hanya admin
DROP POLICY IF EXISTS "Admin can read backup logs" ON public.backup_logs;

-- Buat policy baru: admin bisa baca semua, user bisa baca log yang mereka antrekan
CREATE POLICY "Admin can read all backup logs"
ON public.backup_logs 
FOR SELECT 
TO authenticated 
USING (has_role(auth.uid(), 'ADMIN'::app_role));

CREATE POLICY "User can read own backup logs"
ON public.backup_logs 
FOR SELECT 
TO authenticated 
USING (queued_by = auth.uid());