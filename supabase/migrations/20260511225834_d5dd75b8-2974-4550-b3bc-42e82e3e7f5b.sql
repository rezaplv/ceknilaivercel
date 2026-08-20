-- Fix #2: Restrict kelas_mapel SELECT to authenticated users only (was public/anon)
DROP POLICY IF EXISTS "Authenticated can read kelas_mapel" ON public.kelas_mapel;
CREATE POLICY "Authenticated can read kelas_mapel"
ON public.kelas_mapel
FOR SELECT
TO authenticated
USING (true);

-- Also tighten the admin manage policy to authenticated role
DROP POLICY IF EXISTS "Admin can manage kelas_mapel" ON public.kelas_mapel;
CREATE POLICY "Admin can manage kelas_mapel"
ON public.kelas_mapel
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- Fix #1: Tighten settings table — remove anon read access
DROP POLICY IF EXISTS "Anyone can read settings" ON public.settings;

-- Fix #1 (Realtime): Ensure scores realtime subscriptions enforce RLS.
-- Postgres Changes already respects the SELECT policy on `scores`, but we explicitly
-- set REPLICA IDENTITY FULL so RLS evaluation has full row context for old/new values.
ALTER TABLE public.scores REPLICA IDENTITY FULL;