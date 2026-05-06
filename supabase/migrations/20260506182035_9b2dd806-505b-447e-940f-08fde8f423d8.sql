CREATE TABLE public.event_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#888888',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_event_types"
  ON public.event_types FOR SELECT TO authenticated
  USING (workspace_id = public.get_workspace_id(auth.uid()));

CREATE POLICY "admins_write_event_types"
  ON public.event_types FOR ALL TO authenticated
  USING (workspace_id = public.get_workspace_id(auth.uid()) AND public.is_workspace_admin(auth.uid()))
  WITH CHECK (workspace_id = public.get_workspace_id(auth.uid()) AND public.is_workspace_admin(auth.uid()));