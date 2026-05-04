ALTER TABLE public.tasks ADD COLUMN team_id uuid;
ALTER TABLE public.posts ADD COLUMN team_id uuid;
ALTER TABLE public.calendar_items ADD COLUMN team_id uuid;
CREATE INDEX IF NOT EXISTS idx_tasks_team_id ON public.tasks(team_id);
CREATE INDEX IF NOT EXISTS idx_posts_team_id ON public.posts(team_id);
CREATE INDEX IF NOT EXISTS idx_calendar_items_team_id ON public.calendar_items(team_id);