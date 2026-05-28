
ALTER TABLE public.workspace_members DROP CONSTRAINT IF EXISTS workspace_members_role_check;

UPDATE public.workspace_members SET role = 'member' WHERE role NOT IN ('owner','admin','member');

UPDATE public.workspace_members wm SET role = 'owner'
  FROM public.workspaces w
 WHERE w.id = wm.workspace_id AND w.user_id = wm.user_id;

INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT w.id, w.user_id, 'owner' FROM public.workspaces w
 WHERE NOT EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = w.id AND m.user_id = w.user_id);

ALTER TABLE public.workspace_members
  ADD CONSTRAINT workspace_members_role_check CHECK (role IN ('owner','admin','member'));
