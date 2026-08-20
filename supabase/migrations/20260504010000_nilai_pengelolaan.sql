CREATE TABLE IF NOT EXISTS public.nilai_pengelolaan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  kelas_id uuid NOT NULL,
  mapel_id uuid NOT NULL,
  nilai_asli numeric NOT NULL DEFAULT 0,
  nilai_tambahan numeric NOT NULL DEFAULT 0,
  nilai_final numeric NOT NULL DEFAULT 0,
  kriteria text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, kelas_id, mapel_id)
);
ALTER TABLE public.nilai_pengelolaan ENABLE ROW LEVEL SECURITY;
CREATE POLICY "np_select" ON public.nilai_pengelolaan FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'GURU'::app_role) OR student_id = auth.uid());
CREATE POLICY "np_insert" ON public.nilai_pengelolaan FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'GURU'::app_role));
CREATE POLICY "np_update" ON public.nilai_pengelolaan FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'GURU'::app_role));
CREATE POLICY "np_delete" ON public.nilai_pengelolaan FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'ADMIN'::app_role) OR has_role(auth.uid(), 'GURU'::app_role));
CREATE TRIGGER trg_nilai_pengelolaan_updated_at
  BEFORE UPDATE ON public.nilai_pengelolaan
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
