
-- 1. Create workspaces table
CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Meu Workspace',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- 2. Create people table
CREATE TABLE public.people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;

-- 3. Helper function
CREATE OR REPLACE FUNCTION public.get_workspace_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.workspaces WHERE user_id = _user_id LIMIT 1;
$$;

-- 4. Drop OLD RLS policies BEFORE dropping columns
DROP POLICY IF EXISTS "Users manage own projects" ON public.projects;
DROP POLICY IF EXISTS "Users manage own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users manage own posts" ON public.posts;
DROP POLICY IF EXISTS "Users manage own events" ON public.calendar_events;
DROP POLICY IF EXISTS "Users manage own channels" ON public.channels;
DROP POLICY IF EXISTS "Users manage own categories" ON public.categories;
DROP POLICY IF EXISTS "Users manage own general items" ON public.general_items;
DROP POLICY IF EXISTS "Users manage own teams" ON public.teams;

-- 5. Modify projects
ALTER TABLE public.projects ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.projects DROP COLUMN IF EXISTS team;
ALTER TABLE public.projects DROP COLUMN IF EXISTS members;
ALTER TABLE public.projects DROP COLUMN IF EXISTS user_id;

-- 6. Modify tasks
ALTER TABLE public.tasks ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.tasks DROP COLUMN IF EXISTS responsible;
ALTER TABLE public.tasks DROP COLUMN IF EXISTS user_id;

-- 7. Modify posts
ALTER TABLE public.posts ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.posts DROP COLUMN IF EXISTS responsible;
ALTER TABLE public.posts DROP COLUMN IF EXISTS user_id;

-- 8. Rename calendar_events → calendar_items
ALTER TABLE public.calendar_events RENAME TO calendar_items;
ALTER TABLE public.calendar_items ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.calendar_items DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.calendar_items DROP COLUMN IF EXISTS time;
ALTER TABLE public.calendar_items DROP COLUMN IF EXISTS end_time;

-- 9. Modify channels
ALTER TABLE public.channels ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.channels DROP COLUMN IF EXISTS user_id;

-- 10. Modify categories
ALTER TABLE public.categories ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.categories DROP COLUMN IF EXISTS user_id;

-- 11. Junction tables
CREATE TABLE public.project_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  UNIQUE(project_id, person_id)
);
ALTER TABLE public.project_participants ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.task_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  UNIQUE(task_id, person_id)
);
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.post_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  UNIQUE(post_id, person_id)
);
ALTER TABLE public.post_assignees ENABLE ROW LEVEL SECURITY;

-- 12. Drop old tables
DROP TABLE IF EXISTS public.teams;
DROP TABLE IF EXISTS public.general_items;

-- 13. New RLS policies
CREATE POLICY "Users manage own workspace"
  ON public.workspaces FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own people"
  ON public.people FOR ALL TO authenticated
  USING (workspace_id = public.get_workspace_id(auth.uid()))
  WITH CHECK (workspace_id = public.get_workspace_id(auth.uid()));

CREATE POLICY "Users manage own projects"
  ON public.projects FOR ALL TO authenticated
  USING (workspace_id = public.get_workspace_id(auth.uid()))
  WITH CHECK (workspace_id = public.get_workspace_id(auth.uid()));

CREATE POLICY "Users manage own tasks"
  ON public.tasks FOR ALL TO authenticated
  USING (workspace_id = public.get_workspace_id(auth.uid()))
  WITH CHECK (workspace_id = public.get_workspace_id(auth.uid()));

CREATE POLICY "Users manage own posts"
  ON public.posts FOR ALL TO authenticated
  USING (workspace_id = public.get_workspace_id(auth.uid()))
  WITH CHECK (workspace_id = public.get_workspace_id(auth.uid()));

CREATE POLICY "Users manage own calendar items"
  ON public.calendar_items FOR ALL TO authenticated
  USING (workspace_id = public.get_workspace_id(auth.uid()))
  WITH CHECK (workspace_id = public.get_workspace_id(auth.uid()));

CREATE POLICY "Users manage own channels"
  ON public.channels FOR ALL TO authenticated
  USING (workspace_id = public.get_workspace_id(auth.uid()))
  WITH CHECK (workspace_id = public.get_workspace_id(auth.uid()));

CREATE POLICY "Users manage own categories"
  ON public.categories FOR ALL TO authenticated
  USING (workspace_id = public.get_workspace_id(auth.uid()))
  WITH CHECK (workspace_id = public.get_workspace_id(auth.uid()));

CREATE POLICY "Users manage project participants"
  ON public.project_participants FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND workspace_id = public.get_workspace_id(auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND workspace_id = public.get_workspace_id(auth.uid())));

CREATE POLICY "Users manage task assignees"
  ON public.task_assignees FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks WHERE id = task_id AND workspace_id = public.get_workspace_id(auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tasks WHERE id = task_id AND workspace_id = public.get_workspace_id(auth.uid())));

CREATE POLICY "Users manage post assignees"
  ON public.post_assignees FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND workspace_id = public.get_workspace_id(auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND workspace_id = public.get_workspace_id(auth.uid())));

-- 14. Update handle_new_user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', ''));
  
  INSERT INTO public.workspaces (user_id, name)
  VALUES (NEW.id, 'Meu Workspace');
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
