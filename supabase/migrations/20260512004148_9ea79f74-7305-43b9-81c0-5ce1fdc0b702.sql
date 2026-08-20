DROP POLICY IF EXISTS "Authenticated can read settings" ON public.settings;
CREATE POLICY "Anyone can read settings"
ON public.settings
FOR SELECT
TO anon, authenticated
USING (true);