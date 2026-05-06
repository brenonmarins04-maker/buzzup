
-- 1. Code generator
CREATE OR REPLACE FUNCTION public.generate_access_code()
RETURNS text LANGUAGE plpgsql VOLATILE SET search_path = public AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, 1 + floor(random()*length(chars))::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- 2. Add access_code to workspaces
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS access_code text;
UPDATE public.workspaces SET access_code = public.generate_access_code() WHERE access_code IS NULL;
ALTER TABLE public.workspaces ALTER COLUMN access_code SET NOT NULL;
ALTER TABLE public.workspaces ALTER COLUMN access_code SET DEFAULT public.generate_access_code();
CREATE UNIQUE INDEX IF NOT EXISTS workspaces_access_code_key ON public.workspaces(upper(access_code));

-- 3. Admin check helper (SECURITY DEFINER avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_workspace_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = _user_id
      AND workspace_id = public.get_workspace_id(_user_id)
      AND role = 'admin'
  );
$$;

-- 4. Redeem code RPC
CREATE OR REPLACE FUNCTION public.redeem_access_code(_code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ws uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT id INTO _ws FROM public.workspaces WHERE upper(access_code) = upper(_code) LIMIT 1;
  IF _ws IS NULL THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.workspace_members WHERE user_id = auth.uid() AND workspace_id = _ws) THEN
    RETURN false;
  END IF;
  UPDATE public.workspace_members SET role = 'admin' WHERE user_id = auth.uid() AND workspace_id = _ws;
  RETURN true;
END;
$$;

-- 5. Update handle_new_user: new self-created workspace creator starts as VIEWER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _invite public.workspace_invites%ROWTYPE;
  _ws_id uuid;
  _name text;
BEGIN
  _name := COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1));

  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, _name) ON CONFLICT DO NOTHING;

  SELECT * INTO _invite FROM public.workspace_invites
  WHERE lower(email) = lower(NEW.email) AND status = 'pending' AND expires_at > now()
  ORDER BY created_at DESC LIMIT 1;

  IF _invite.id IS NOT NULL THEN
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (_invite.workspace_id, NEW.id, _invite.role)
    ON CONFLICT (workspace_id, user_id) DO NOTHING;

    UPDATE public.workspace_invites SET status = 'accepted', accepted_at = now() WHERE id = _invite.id;
    UPDATE public.people SET user_id = NEW.id, invite_status = 'accepted'
      WHERE workspace_id = _invite.workspace_id AND lower(email) = lower(NEW.email);
  ELSE
    INSERT INTO public.workspaces (user_id, name)
    VALUES (NEW.id, 'Meu Workspace') RETURNING id INTO _ws_id;

    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (_ws_id, NEW.id, 'viewer')
    ON CONFLICT (workspace_id, user_id) DO NOTHING;

    INSERT INTO public.people (workspace_id, name, email, role, user_id, invite_status)
    VALUES (_ws_id, _name, lower(NEW.email), 'viewer', NEW.id, 'accepted')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- 6. Replace tenant table RLS: SELECT for any member, write for admin only
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['calendar_items','categories','channels','people','posts','projects','tasks','teams','workspace_invites']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Users manage own %s" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Members manage workspace invites" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "members_select_%s" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "admins_write_%s" ON public.%I', t, t);
    EXECUTE format($p$CREATE POLICY "members_select_%s" ON public.%I FOR SELECT TO authenticated USING (workspace_id = public.get_workspace_id(auth.uid()))$p$, t, t);
    EXECUTE format($p$CREATE POLICY "admins_write_%s" ON public.%I FOR ALL TO authenticated USING (workspace_id = public.get_workspace_id(auth.uid()) AND public.is_workspace_admin(auth.uid())) WITH CHECK (workspace_id = public.get_workspace_id(auth.uid()) AND public.is_workspace_admin(auth.uid()))$p$, t, t);
  END LOOP;
END $$;

-- 7. Child tables (depend on parent's workspace via existing pattern + admin gate)
DROP POLICY IF EXISTS "Users manage post assignees" ON public.post_assignees;
CREATE POLICY "members_select_post_assignees" ON public.post_assignees FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.posts WHERE posts.id = post_assignees.post_id AND posts.workspace_id = public.get_workspace_id(auth.uid())));
CREATE POLICY "admins_write_post_assignees" ON public.post_assignees FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.posts WHERE posts.id = post_assignees.post_id AND posts.workspace_id = public.get_workspace_id(auth.uid())) AND public.is_workspace_admin(auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.posts WHERE posts.id = post_assignees.post_id AND posts.workspace_id = public.get_workspace_id(auth.uid())) AND public.is_workspace_admin(auth.uid()));

DROP POLICY IF EXISTS "Users manage task assignees" ON public.task_assignees;
CREATE POLICY "members_select_task_assignees" ON public.task_assignees FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_assignees.task_id AND tasks.workspace_id = public.get_workspace_id(auth.uid())));
CREATE POLICY "admins_write_task_assignees" ON public.task_assignees FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_assignees.task_id AND tasks.workspace_id = public.get_workspace_id(auth.uid())) AND public.is_workspace_admin(auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_assignees.task_id AND tasks.workspace_id = public.get_workspace_id(auth.uid())) AND public.is_workspace_admin(auth.uid()));

DROP POLICY IF EXISTS "Users manage project participants" ON public.project_participants;
CREATE POLICY "members_select_project_participants" ON public.project_participants FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_participants.project_id AND projects.workspace_id = public.get_workspace_id(auth.uid())));
CREATE POLICY "admins_write_project_participants" ON public.project_participants FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_participants.project_id AND projects.workspace_id = public.get_workspace_id(auth.uid())) AND public.is_workspace_admin(auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_participants.project_id AND projects.workspace_id = public.get_workspace_id(auth.uid())) AND public.is_workspace_admin(auth.uid()));

DROP POLICY IF EXISTS "Users manage team members" ON public.team_members;
CREATE POLICY "members_select_team_members" ON public.team_members FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teams WHERE teams.id = team_members.team_id AND teams.workspace_id = public.get_workspace_id(auth.uid())));
CREATE POLICY "admins_write_team_members" ON public.team_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teams WHERE teams.id = team_members.team_id AND teams.workspace_id = public.get_workspace_id(auth.uid())) AND public.is_workspace_admin(auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.teams WHERE teams.id = team_members.team_id AND teams.workspace_id = public.get_workspace_id(auth.uid())) AND public.is_workspace_admin(auth.uid()));
