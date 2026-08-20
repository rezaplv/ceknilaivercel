-- Fix audit_logs SELECT policy to be PERMISSIVE
DROP POLICY IF EXISTS "Only admins can read audit logs" ON public.audit_logs;

CREATE POLICY "Only admins can read audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'ADMIN'::app_role));
