ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 0;
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS nickname text;