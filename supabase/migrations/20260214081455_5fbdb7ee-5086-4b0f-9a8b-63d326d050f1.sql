-- Add nilai_asli column to store original value shown to students
ALTER TABLE public.scores ADD COLUMN nilai_asli numeric DEFAULT NULL;

COMMENT ON COLUMN public.scores.nilai_asli IS 'Original score locked for student view. When not null, students see this instead of nilai.';