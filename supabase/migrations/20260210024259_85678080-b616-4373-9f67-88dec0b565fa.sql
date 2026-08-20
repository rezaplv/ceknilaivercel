-- Fix: restrict audit_logs INSERT to service_role only
DROP POLICY "Service role can insert audit logs" ON public.audit_logs;

CREATE POLICY "Service role can insert audit logs"
  ON public.audit_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);