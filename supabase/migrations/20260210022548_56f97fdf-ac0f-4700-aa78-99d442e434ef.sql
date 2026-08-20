
-- Fix 1: Add audit_logs table for admin action tracking
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  performed_by UUID NOT NULL,
  target_user_id UUID,
  target_role TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can read audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role));

CREATE POLICY "Service role can insert audit logs"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- Fix 2: Add missing UPDATE policy for broadcasts
CREATE POLICY "Admin or creator can update broadcasts"
  ON public.broadcasts FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'ADMIN'::app_role)
    OR created_by = auth.uid()
  );
