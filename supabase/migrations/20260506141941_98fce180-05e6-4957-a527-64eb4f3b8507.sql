
ALTER TABLE public.workspace_members DROP CONSTRAINT IF EXISTS workspace_members_role_check;
ALTER TABLE public.workspace_members ADD CONSTRAINT workspace_members_role_check
  CHECK (role IN ('admin','member','viewer'));

ALTER TABLE public.people DROP CONSTRAINT IF EXISTS people_role_check;
