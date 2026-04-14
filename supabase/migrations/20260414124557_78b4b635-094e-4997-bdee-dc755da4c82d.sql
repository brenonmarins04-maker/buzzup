
-- Create workspaces for existing users that don't have one
INSERT INTO public.workspaces (user_id, name)
SELECT id, 'Meu Workspace' FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.workspaces);

-- Clean up any orphan rows with NULL workspace_id
DELETE FROM public.projects WHERE workspace_id IS NULL;
DELETE FROM public.tasks WHERE workspace_id IS NULL;
DELETE FROM public.posts WHERE workspace_id IS NULL;
DELETE FROM public.calendar_items WHERE workspace_id IS NULL;
DELETE FROM public.channels WHERE workspace_id IS NULL;
DELETE FROM public.categories WHERE workspace_id IS NULL;

-- Set workspace_id NOT NULL
ALTER TABLE public.projects ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.tasks ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.posts ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.calendar_items ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.channels ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.categories ALTER COLUMN workspace_id SET NOT NULL;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_people_workspace ON public.people(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON public.tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_posts_workspace ON public.posts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON public.projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_calendar_items_workspace ON public.calendar_items(workspace_id);
CREATE INDEX IF NOT EXISTS idx_channels_workspace ON public.channels(workspace_id);
CREATE INDEX IF NOT EXISTS idx_categories_workspace ON public.categories(workspace_id);
