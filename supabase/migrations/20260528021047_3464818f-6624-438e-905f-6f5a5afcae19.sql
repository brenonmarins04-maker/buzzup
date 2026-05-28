-- ============ DROP EVERYTHING ============
DROP FUNCTION IF EXISTS public.demote_self_to_viewer() CASCADE;
DROP FUNCTION IF EXISTS public.accept_workspace_invite(text) CASCADE;
DROP FUNCTION IF EXISTS public.create_workspace_invite(uuid,text,integer,integer) CASCADE;
DROP FUNCTION IF EXISTS public.revoke_workspace_invite(uuid,uuid) CASCADE;
DROP FUNCTION IF EXISTS public.remove_workspace_member(uuid,uuid) CASCADE;
DROP FUNCTION IF EXISTS public.update_member_role(uuid,uuid,text) CASCADE;
DROP FUNCTION IF EXISTS public.create_workspace(text) CASCADE;
DROP FUNCTION IF EXISTS public.is_workspace_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_workspace_owner(uuid,uuid) CASCADE;
DROP FUNCTION IF EXISTS public.current_workspace_role(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_workspace_id(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.generate_invite_code() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

DROP TABLE IF EXISTS public.gamification_awards CASCADE;
DROP TABLE IF EXISTS public.gamification_actions CASCADE;
DROP TABLE IF EXISTS public.broadcasts CASCADE;
DROP TABLE IF EXISTS public.attendance_settings CASCADE;
DROP TABLE IF EXISTS public.attendance_records CASCADE;
DROP TABLE IF EXISTS public.lead_thermometer CASCADE;
DROP TABLE IF EXISTS public.parking_items CASCADE;
DROP TABLE IF EXISTS public.area_notes CASCADE;
DROP TABLE IF EXISTS public.calendar_items CASCADE;
DROP TABLE IF EXISTS public.event_types CASCADE;
DROP TABLE IF EXISTS public.channels CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
DROP TABLE IF EXISTS public.post_assignees CASCADE;
DROP TABLE IF EXISTS public.posts CASCADE;
DROP TABLE IF EXISTS public.task_assignees CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.team_members CASCADE;
DROP TABLE IF EXISTS public.teams CASCADE;
DROP TABLE IF EXISTS public.project_participants CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;
DROP TABLE IF EXISTS public.people CASCADE;
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.workspace_invites CASCADE;
DROP TABLE IF EXISTS public.workspace_members CASCADE;
DROP TABLE IF EXISTS public.workspaces CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY,
  display_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)), NEW.email)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- ============ WORKSPACES ============
CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  owner_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('owner','admin','member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
CREATE INDEX idx_wm_user ON public.workspace_members(user_id);
CREATE INDEX idx_wm_ws ON public.workspace_members(workspace_id);
GRANT SELECT ON public.workspace_members TO authenticated;
GRANT ALL ON public.workspace_members TO service_role;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.workspace_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','canceled')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid,
  decided_role text
);
CREATE UNIQUE INDEX uniq_pending_req ON public.workspace_join_requests(workspace_id, user_id) WHERE status='pending';
CREATE INDEX idx_jr_user ON public.workspace_join_requests(user_id);
CREATE INDEX idx_jr_ws ON public.workspace_join_requests(workspace_id);
GRANT SELECT ON public.workspace_join_requests TO authenticated;
GRANT ALL ON public.workspace_join_requests TO service_role;
ALTER TABLE public.workspace_join_requests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_member_of(_user_id uuid, _ws_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE user_id=_user_id AND workspace_id=_ws_id)
$$;

CREATE OR REPLACE FUNCTION public.is_admin_of(_user_id uuid, _ws_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE user_id=_user_id AND workspace_id=_ws_id AND role IN ('owner','admin'))
$$;

CREATE OR REPLACE FUNCTION public.is_owner_of(_user_id uuid, _ws_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE user_id=_user_id AND workspace_id=_ws_id AND role='owner')
$$;

CREATE POLICY "ws_select_members" ON public.workspaces FOR SELECT TO authenticated USING (public.is_member_of(auth.uid(), id));
CREATE POLICY "wm_select_peers" ON public.workspace_members FOR SELECT TO authenticated USING (public.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "jr_select_own_or_owner" ON public.workspace_join_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_owner_of(auth.uid(), workspace_id));

CREATE OR REPLACE FUNCTION public.generate_workspace_code()
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; result text; i int; tries int := 0;
BEGIN
  LOOP
    result := 'BUZZ-';
    FOR i IN 1..6 LOOP result := result || substr(chars, 1 + floor(random()*length(chars))::int, 1); END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.workspaces WHERE code = result);
    tries := tries + 1;
    IF tries > 10 THEN RAISE EXCEPTION 'could_not_generate_code'; END IF;
  END LOOP;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.create_workspace(_name text)
RETURNS public.workspaces LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ws public.workspaces;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF coalesce(trim(_name),'') = '' THEN RAISE EXCEPTION 'invalid_name'; END IF;
  INSERT INTO public.workspaces (name, code, owner_user_id)
    VALUES (trim(_name), public.generate_workspace_code(), auth.uid())
    RETURNING * INTO _ws;
  INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES (_ws.id, auth.uid(), 'owner');
  RETURN _ws;
END $$;

CREATE OR REPLACE FUNCTION public.request_join_workspace(_code text)
RETURNS public.workspace_join_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ws public.workspaces; _req public.workspace_join_requests;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO _ws FROM public.workspaces WHERE code = upper(trim(_code));
  IF _ws.id IS NULL THEN RAISE EXCEPTION 'invalid_code'; END IF;
  IF EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id=_ws.id AND user_id=auth.uid()) THEN
    RAISE EXCEPTION 'already_member';
  END IF;
  IF EXISTS (SELECT 1 FROM public.workspace_join_requests WHERE workspace_id=_ws.id AND user_id=auth.uid() AND status='pending') THEN
    RAISE EXCEPTION 'already_pending';
  END IF;
  INSERT INTO public.workspace_join_requests (workspace_id, user_id) VALUES (_ws.id, auth.uid()) RETURNING * INTO _req;
  RETURN _req;
END $$;

CREATE OR REPLACE FUNCTION public.approve_join_request(_req_id uuid, _role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _req public.workspace_join_requests;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _role NOT IN ('admin','member') THEN RAISE EXCEPTION 'invalid_role'; END IF;
  SELECT * INTO _req FROM public.workspace_join_requests WHERE id=_req_id;
  IF _req.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT public.is_owner_of(auth.uid(), _req.workspace_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _req.status <> 'pending' THEN RAISE EXCEPTION 'not_pending'; END IF;
  INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES (_req.workspace_id, _req.user_id, _role)
    ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role;
  UPDATE public.workspace_join_requests SET status='approved', decided_at=now(), decided_by=auth.uid(), decided_role=_role WHERE id=_req_id;
END $$;

CREATE OR REPLACE FUNCTION public.reject_join_request(_req_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _req public.workspace_join_requests;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO _req FROM public.workspace_join_requests WHERE id=_req_id;
  IF _req.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT public.is_owner_of(auth.uid(), _req.workspace_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _req.status <> 'pending' THEN RAISE EXCEPTION 'not_pending'; END IF;
  UPDATE public.workspace_join_requests SET status='rejected', decided_at=now(), decided_by=auth.uid() WHERE id=_req_id;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_join_request(_req_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE public.workspace_join_requests SET status='canceled', decided_at=now()
   WHERE id=_req_id AND user_id=auth.uid() AND status='pending';
END $$;

CREATE OR REPLACE FUNCTION public.list_my_workspaces()
RETURNS TABLE(workspace_id uuid, name text, code text, role text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT w.id, w.name, w.code, m.role, w.created_at
  FROM public.workspaces w
  JOIN public.workspace_members m ON m.workspace_id = w.id AND m.user_id = auth.uid()
  ORDER BY w.created_at DESC
$$;

CREATE OR REPLACE FUNCTION public.list_my_join_requests()
RETURNS TABLE(id uuid, workspace_id uuid, workspace_name text, workspace_code text, status text, requested_at timestamptz, decided_at timestamptz, decided_role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.workspace_id, w.name, w.code, r.status, r.requested_at, r.decided_at, r.decided_role
  FROM public.workspace_join_requests r
  JOIN public.workspaces w ON w.id = r.workspace_id
  WHERE r.user_id = auth.uid()
  ORDER BY r.requested_at DESC
$$;

CREATE OR REPLACE FUNCTION public.list_workspace_join_requests(_ws_id uuid)
RETURNS TABLE(id uuid, user_id uuid, display_name text, email text, status text, requested_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_owner_of(auth.uid(), _ws_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
    SELECT r.id, r.user_id, p.display_name, p.email, r.status, r.requested_at
    FROM public.workspace_join_requests r
    JOIN public.profiles p ON p.user_id = r.user_id
    WHERE r.workspace_id = _ws_id AND r.status = 'pending'
    ORDER BY r.requested_at ASC;
END $$;

CREATE OR REPLACE FUNCTION public.list_workspace_members(_ws_id uuid)
RETURNS TABLE(user_id uuid, display_name text, email text, role text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_member_of(auth.uid(), _ws_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
    SELECT m.user_id, p.display_name, p.email, m.role, m.created_at
    FROM public.workspace_members m
    JOIN public.profiles p ON p.user_id = m.user_id
    WHERE m.workspace_id = _ws_id
    ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, m.created_at;
END $$;

CREATE OR REPLACE FUNCTION public.update_member_role(_ws_id uuid, _target uuid, _new_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_owner_of(auth.uid(), _ws_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _new_role NOT IN ('admin','member') THEN RAISE EXCEPTION 'invalid_role'; END IF;
  IF _target = auth.uid() THEN RAISE EXCEPTION 'cannot_change_self'; END IF;
  UPDATE public.workspace_members SET role=_new_role WHERE workspace_id=_ws_id AND user_id=_target AND role <> 'owner';
END $$;

CREATE OR REPLACE FUNCTION public.remove_workspace_member(_ws_id uuid, _target uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_owner_of(auth.uid(), _ws_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _target = auth.uid() THEN RAISE EXCEPTION 'cannot_remove_self'; END IF;
  DELETE FROM public.workspace_members WHERE workspace_id=_ws_id AND user_id=_target AND role <> 'owner';
END $$;

-- ============ CONTENT TABLES ============
CREATE TABLE public.people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  nickname text,
  email text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'member',
  area text,
  user_id uuid,
  invite_status text NOT NULL DEFAULT 'not_sent',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.people TO authenticated;
GRANT ALL ON public.people TO service_role;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
CREATE POLICY "people_sel" ON public.people FOR SELECT TO authenticated USING (public.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "people_w" ON public.people FOR ALL TO authenticated USING (public.is_admin_of(auth.uid(), workspace_id)) WITH CHECK (public.is_admin_of(auth.uid(), workspace_id));

CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teams_sel" ON public.teams FOR SELECT TO authenticated USING (public.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "teams_w" ON public.teams FOR ALL TO authenticated USING (public.is_admin_of(auth.uid(), workspace_id)) WITH CHECK (public.is_admin_of(auth.uid(), workspace_id));

CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tm_sel" ON public.team_members FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id=team_members.team_id AND public.is_member_of(auth.uid(), t.workspace_id)));
CREATE POLICY "tm_w" ON public.team_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id=team_members.team_id AND public.is_admin_of(auth.uid(), t.workspace_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.teams t WHERE t.id=team_members.team_id AND public.is_admin_of(auth.uid(), t.workspace_id)));

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#888888',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proj_sel" ON public.projects FOR SELECT TO authenticated USING (public.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "proj_w" ON public.projects FOR ALL TO authenticated USING (public.is_admin_of(auth.uid(), workspace_id)) WITH CHECK (public.is_admin_of(auth.uid(), workspace_id));

CREATE TABLE public.project_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_participants TO authenticated;
GRANT ALL ON public.project_participants TO service_role;
ALTER TABLE public.project_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pp_sel" ON public.project_participants FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id=project_id AND public.is_member_of(auth.uid(), p.workspace_id)));
CREATE POLICY "pp_w" ON public.project_participants FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id=project_id AND public.is_admin_of(auth.uid(), p.workspace_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id=project_id AND public.is_admin_of(auth.uid(), p.workspace_id)));

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  area text,
  team text NOT NULL DEFAULT '',
  team_id uuid,
  deadline text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'not-started',
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_sel" ON public.tasks FOR SELECT TO authenticated USING (public.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "tasks_w" ON public.tasks FOR ALL TO authenticated USING (public.is_admin_of(auth.uid(), workspace_id)) WITH CHECK (public.is_admin_of(auth.uid(), workspace_id));

CREATE TABLE public.task_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_assignees TO authenticated;
GRANT ALL ON public.task_assignees TO service_role;
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ta_sel" ON public.task_assignees FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id=task_id AND public.is_member_of(auth.uid(), t.workspace_id)));
CREATE POLICY "ta_w" ON public.task_assignees FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id=task_id AND public.is_admin_of(auth.uid(), t.workspace_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id=task_id AND public.is_admin_of(auth.uid(), t.workspace_id)));

CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  copy text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  channel text NOT NULL DEFAULT '',
  date text NOT NULL DEFAULT '',
  time text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  link text NOT NULL DEFAULT '',
  media_url text NOT NULL DEFAULT '',
  team_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts_sel" ON public.posts FOR SELECT TO authenticated USING (public.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "posts_w" ON public.posts FOR ALL TO authenticated USING (public.is_admin_of(auth.uid(), workspace_id)) WITH CHECK (public.is_admin_of(auth.uid(), workspace_id));

CREATE TABLE public.post_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_assignees TO authenticated;
GRANT ALL ON public.post_assignees TO service_role;
ALTER TABLE public.post_assignees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pa_sel" ON public.post_assignees FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id=post_id AND public.is_member_of(auth.uid(), p.workspace_id)));
CREATE POLICY "pa_w" ON public.post_assignees FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id=post_id AND public.is_admin_of(auth.uid(), p.workspace_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.posts p WHERE p.id=post_id AND public.is_admin_of(auth.uid(), p.workspace_id)));

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_sel" ON public.categories FOR SELECT TO authenticated USING (public.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "cat_w" ON public.categories FOR ALL TO authenticated USING (public.is_admin_of(auth.uid(), workspace_id)) WITH CHECK (public.is_admin_of(auth.uid(), workspace_id));

CREATE TABLE public.channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#888888',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channels TO authenticated;
GRANT ALL ON public.channels TO service_role;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ch_sel" ON public.channels FOR SELECT TO authenticated USING (public.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "ch_w" ON public.channels FOR ALL TO authenticated USING (public.is_admin_of(auth.uid(), workspace_id)) WITH CHECK (public.is_admin_of(auth.uid(), workspace_id));

CREATE TABLE public.event_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#888888',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_types TO authenticated;
GRANT ALL ON public.event_types TO service_role;
ALTER TABLE public.event_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "et_sel" ON public.event_types FOR SELECT TO authenticated USING (public.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "et_w" ON public.event_types FOR ALL TO authenticated USING (public.is_admin_of(auth.uid(), workspace_id)) WITH CHECK (public.is_admin_of(auth.uid(), workspace_id));

CREATE TABLE public.calendar_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  date text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'event',
  area text,
  team_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_items TO authenticated;
GRANT ALL ON public.calendar_items TO service_role;
ALTER TABLE public.calendar_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ci_sel" ON public.calendar_items FOR SELECT TO authenticated USING (public.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "ci_w" ON public.calendar_items FOR ALL TO authenticated USING (public.is_admin_of(auth.uid(), workspace_id)) WITH CHECK (public.is_admin_of(auth.uid(), workspace_id));

CREATE TABLE public.area_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  area text NOT NULL,
  name text NOT NULL,
  url text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.area_notes TO authenticated;
GRANT ALL ON public.area_notes TO service_role;
ALTER TABLE public.area_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "an_sel" ON public.area_notes FOR SELECT TO authenticated USING (public.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "an_w" ON public.area_notes FOR ALL TO authenticated USING (public.is_admin_of(auth.uid(), workspace_id)) WITH CHECK (public.is_admin_of(auth.uid(), workspace_id));

CREATE TABLE public.parking_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  area text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  date text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  person_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parking_items TO authenticated;
GRANT ALL ON public.parking_items TO service_role;
ALTER TABLE public.parking_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pi_sel" ON public.parking_items FOR SELECT TO authenticated USING (public.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "pi_w" ON public.parking_items FOR ALL TO authenticated USING (public.is_admin_of(auth.uid(), workspace_id)) WITH CHECK (public.is_admin_of(auth.uid(), workspace_id));

CREATE TABLE public.lead_thermometer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  value text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT '',
  area_size text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_thermometer TO authenticated;
GRANT ALL ON public.lead_thermometer TO service_role;
ALTER TABLE public.lead_thermometer ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lt_sel" ON public.lead_thermometer FOR SELECT TO authenticated USING (public.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "lt_w" ON public.lead_thermometer FOR ALL TO authenticated USING (public.is_admin_of(auth.uid(), workspace_id)) WITH CHECK (public.is_admin_of(auth.uid(), workspace_id));

CREATE TABLE public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  area text NOT NULL,
  person_id uuid NOT NULL,
  date text NOT NULL,
  status text NOT NULL DEFAULT 'P',
  justification text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO authenticated;
GRANT ALL ON public.attendance_records TO service_role;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ar_sel" ON public.attendance_records FOR SELECT TO authenticated USING (public.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "ar_w" ON public.attendance_records FOR ALL TO authenticated USING (public.is_admin_of(auth.uid(), workspace_id)) WITH CHECK (public.is_admin_of(auth.uid(), workspace_id));

CREATE TABLE public.attendance_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  area text NOT NULL,
  start_date text NOT NULL DEFAULT '',
  interval_days integer NOT NULL DEFAULT 7,
  meeting_count integer NOT NULL DEFAULT 8,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_settings TO authenticated;
GRANT ALL ON public.attendance_settings TO service_role;
ALTER TABLE public.attendance_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "as_sel" ON public.attendance_settings FOR SELECT TO authenticated USING (public.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "as_w" ON public.attendance_settings FOR ALL TO authenticated USING (public.is_admin_of(auth.uid(), workspace_id)) WITH CHECK (public.is_admin_of(auth.uid(), workspace_id));

CREATE TABLE public.broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  message text NOT NULL,
  duration_days integer NOT NULL DEFAULT 7,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.broadcasts TO authenticated;
GRANT ALL ON public.broadcasts TO service_role;
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "br_sel" ON public.broadcasts FOR SELECT TO authenticated USING (public.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "br_w" ON public.broadcasts FOR ALL TO authenticated USING (public.is_admin_of(auth.uid(), workspace_id)) WITH CHECK (public.is_admin_of(auth.uid(), workspace_id));

CREATE TABLE public.gamification_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gamification_actions TO authenticated;
GRANT ALL ON public.gamification_actions TO service_role;
ALTER TABLE public.gamification_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ga_sel" ON public.gamification_actions FOR SELECT TO authenticated USING (public.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "ga_w" ON public.gamification_actions FOR ALL TO authenticated USING (public.is_admin_of(auth.uid(), workspace_id)) WITH CHECK (public.is_admin_of(auth.uid(), workspace_id));

CREATE TABLE public.gamification_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  person_id uuid NOT NULL,
  action_id uuid,
  action_name text NOT NULL,
  points integer NOT NULL DEFAULT 0,
  awarded_by uuid,
  awarded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gamification_awards TO authenticated;
GRANT ALL ON public.gamification_awards TO service_role;
ALTER TABLE public.gamification_awards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gw_sel" ON public.gamification_awards FOR SELECT TO authenticated USING (public.is_member_of(auth.uid(), workspace_id));
CREATE POLICY "gw_w" ON public.gamification_awards FOR ALL TO authenticated USING (public.is_admin_of(auth.uid(), workspace_id)) WITH CHECK (public.is_admin_of(auth.uid(), workspace_id));

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_join_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_members;
ALTER TABLE public.workspace_join_requests REPLICA IDENTITY FULL;
ALTER TABLE public.workspace_members REPLICA IDENTITY FULL;