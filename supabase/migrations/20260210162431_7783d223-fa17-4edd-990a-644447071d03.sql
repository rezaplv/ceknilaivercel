-- Allow anonymous users to read settings (needed for login page logo/bg)
CREATE POLICY "Anyone can read settings"
ON public.settings
FOR SELECT
TO anon
USING (true);