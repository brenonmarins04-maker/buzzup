CREATE TABLE public.broadcasts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  message text NOT NULL,
  duration_days integer NOT NULL DEFAULT 7,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.broadcasts TO authenticated;
GRANT ALL ON public.broadcasts TO service_role;

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_broadcasts" ON public.broadcasts FOR SELECT TO authenticated
  USING (workspace_id = get_workspace_id(auth.uid()));

CREATE POLICY "admins_write_broadcasts" ON public.broadcasts FOR ALL TO authenticated
  USING (workspace_id = get_workspace_id(auth.uid()) AND is_workspace_admin(auth.uid()))
  WITH CHECK (workspace_id = get_workspace_id(auth.uid()) AND is_workspace_admin(auth.uid()));