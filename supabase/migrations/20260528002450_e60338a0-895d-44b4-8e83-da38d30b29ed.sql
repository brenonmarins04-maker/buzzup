
CREATE TABLE public.gamification_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  name text NOT NULL,
  points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gamification_actions TO authenticated;
GRANT ALL ON public.gamification_actions TO service_role;
ALTER TABLE public.gamification_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_select_gamification_actions" ON public.gamification_actions
  FOR SELECT TO authenticated USING (workspace_id = get_workspace_id(auth.uid()));
CREATE POLICY "admins_write_gamification_actions" ON public.gamification_actions
  FOR ALL TO authenticated
  USING (workspace_id = get_workspace_id(auth.uid()) AND is_workspace_admin(auth.uid()))
  WITH CHECK (workspace_id = get_workspace_id(auth.uid()) AND is_workspace_admin(auth.uid()));

CREATE TABLE public.gamification_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  person_id uuid NOT NULL,
  action_id uuid,
  action_name text NOT NULL,
  points integer NOT NULL DEFAULT 0,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  awarded_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gamification_awards TO authenticated;
GRANT ALL ON public.gamification_awards TO service_role;
ALTER TABLE public.gamification_awards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_select_gamification_awards" ON public.gamification_awards
  FOR SELECT TO authenticated USING (workspace_id = get_workspace_id(auth.uid()));
CREATE POLICY "admins_write_gamification_awards" ON public.gamification_awards
  FOR ALL TO authenticated
  USING (workspace_id = get_workspace_id(auth.uid()) AND is_workspace_admin(auth.uid()))
  WITH CHECK (workspace_id = get_workspace_id(auth.uid()) AND is_workspace_admin(auth.uid()));
