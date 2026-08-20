
-- Enable cron + http
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Dedupe antrian: 1 baris per (kelas_id, mapel_id)
CREATE UNIQUE INDEX IF NOT EXISTS backup_queue_kelas_mapel_uniq
  ON public.backup_queue (kelas_id, mapel_id);

-- Trigger function: enqueue ke backup_queue
CREATE OR REPLACE FUNCTION public.enqueue_backup_on_score_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kelas uuid;
  v_mapel uuid;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    v_kelas := OLD.kelas_id;
    v_mapel := OLD.mapel_id;
  ELSE
    v_kelas := NEW.kelas_id;
    v_mapel := NEW.mapel_id;
  END IF;

  INSERT INTO public.backup_queue (kelas_id, mapel_id, queued_by, attempts)
  VALUES (v_kelas, v_mapel, auth.uid(), 0)
  ON CONFLICT (kelas_id, mapel_id) DO UPDATE
    SET queued_at = now(), attempts = 0, last_error = NULL;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_scores_enqueue_backup ON public.scores;
CREATE TRIGGER trg_scores_enqueue_backup
AFTER INSERT OR UPDATE OR DELETE ON public.scores
FOR EACH ROW EXECUTE FUNCTION public.enqueue_backup_on_score_change();
