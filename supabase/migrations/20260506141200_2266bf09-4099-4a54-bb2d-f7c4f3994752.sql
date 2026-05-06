
DROP POLICY IF EXISTS "Users manage own workspace" ON public.workspaces;
CREATE POLICY "owners_manage_workspace" ON public.workspaces FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "members_select_workspace" ON public.workspaces FOR SELECT TO authenticated
  USING (id = public.get_workspace_id(auth.uid()));
