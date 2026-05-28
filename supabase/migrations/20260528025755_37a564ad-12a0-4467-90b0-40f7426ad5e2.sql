
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS manager_id uuid,
  ADD COLUMN IF NOT EXISTS pipeline_status text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS start_date text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS end_contract text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS end_delivered text NOT NULL DEFAULT '';
