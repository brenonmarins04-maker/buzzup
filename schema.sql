-- ==============================================================
-- BuzzUp — Schema completo para o Supabase novo
-- ==============================================================
-- Rode este arquivo no SQL Editor do Supabase do SEU projeto.
-- Pode rodar 100% de uma vez. Tudo é idempotente (CREATE IF NOT EXISTS,
-- CREATE OR REPLACE) — pode rodar mais de uma vez sem quebrar.
-- ==============================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================
-- 1. TABELAS PRINCIPAIS
-- ==============================================================

-- workspaces (raiz de tudo)
CREATE TABLE IF NOT EXISTS public.workspaces (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  code            TEXT NOT NULL UNIQUE,
  owner_user_id   UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- profiles (1 por user)
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT NOT NULL DEFAULT '',
  email         TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- workspace_members (relação user ↔ workspace + role)
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'member',     -- owner | admin | member | leader
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, user_id)
);

-- workspace_join_requests
CREATE TABLE IF NOT EXISTS public.workspace_join_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'pending',   -- pending | approved | rejected | canceled
  requested_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at     TIMESTAMPTZ,
  decided_by     UUID REFERENCES auth.users(id),
  decided_role   TEXT
);

-- people (pessoas operacionais)
CREATE TABLE IF NOT EXISTS public.people (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL DEFAULT '',
  nickname       TEXT,
  area           TEXT,            -- pode ser comma-separated p/ múltiplas
  role           TEXT NOT NULL DEFAULT 'member',
  invite_status  TEXT NOT NULL DEFAULT 'pending',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_people_workspace ON public.people(workspace_id);
CREATE INDEX IF NOT EXISTS idx_people_user      ON public.people(user_id);

-- teams
CREATE TABLE IF NOT EXISTS public.teams (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.team_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  person_id  UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  UNIQUE (team_id, person_id)
);

-- projects
CREATE TABLE IF NOT EXISTS public.projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  color           TEXT NOT NULL DEFAULT '#3B82F6',
  status          TEXT NOT NULL DEFAULT 'active',
  manager_id      UUID REFERENCES public.people(id) ON DELETE SET NULL,
  pipeline_status TEXT NOT NULL DEFAULT '',
  start_date      TEXT NOT NULL DEFAULT '',
  end_contract    TEXT NOT NULL DEFAULT '',
  end_delivered   TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.project_participants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  person_id   UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  UNIQUE (project_id, person_id)
);

-- tasks (sistema antigo, ainda usado)
CREATE TABLE IF NOT EXISTS public.tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  team          TEXT NOT NULL DEFAULT '',
  team_id       UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  deadline      TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'not-started',
  checklist     JSONB NOT NULL DEFAULT '[]'::jsonb,
  points        INT NOT NULL DEFAULT 0,
  area          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.task_assignees (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  person_id  UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  UNIQUE (task_id, person_id)
);

-- posts
CREATE TABLE IF NOT EXISTS public.posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  copy          TEXT NOT NULL DEFAULT '',
  channel       TEXT NOT NULL DEFAULT '',
  category      TEXT NOT NULL DEFAULT '',
  date          TEXT NOT NULL DEFAULT '',
  time          TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'not-started',
  team_id       UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  link          TEXT NOT NULL DEFAULT '',
  media_url     TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.post_assignees (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  person_id  UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  UNIQUE (post_id, person_id)
);

-- calendar_items (eventos)
CREATE TABLE IF NOT EXISTS public.calendar_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  date          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'Evento',
  area          TEXT,
  team_id       UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- categories, channels, event_types
CREATE TABLE IF NOT EXISTS public.categories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.channels (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  color        TEXT NOT NULL DEFAULT '#888888',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.event_types (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  color        TEXT NOT NULL DEFAULT '#2E9E6E',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- area_notes (links úteis por área)
CREATE TABLE IF NOT EXISTS public.area_notes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  area         TEXT NOT NULL,
  name         TEXT NOT NULL,
  url          TEXT NOT NULL DEFAULT '',
  position     INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- parking_items (Quadro CB)
CREATE TABLE IF NOT EXISTS public.parking_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  area          TEXT NOT NULL DEFAULT '',
  person_id     UUID REFERENCES public.people(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  date          TEXT NOT NULL DEFAULT '',
  position      INT NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'in-progress',
  points        INT NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_parking_workspace ON public.parking_items(workspace_id);

-- Gamification
CREATE TABLE IF NOT EXISTS public.gamification_actions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  points       INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.gamification_awards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  person_id     UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  action_id     UUID REFERENCES public.gamification_actions(id) ON DELETE SET NULL,
  action_name   TEXT NOT NULL,
  points        INT NOT NULL DEFAULT 0,
  awarded_by    UUID REFERENCES auth.users(id),
  awarded_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- lead_thermometer
CREATE TABLE IF NOT EXISTS public.lead_thermometer (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  value        TEXT NOT NULL DEFAULT '',
  area_size    TEXT NOT NULL DEFAULT '',
  type         TEXT NOT NULL DEFAULT '',
  position     INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Attendance
CREATE TABLE IF NOT EXISTS public.attendance_settings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  area          TEXT NOT NULL,
  interval_days INT NOT NULL DEFAULT 7,
  start_date    TEXT NOT NULL DEFAULT '',
  meeting_count INT NOT NULL DEFAULT 8,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, area)
);

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  area          TEXT NOT NULL,
  person_id     UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  date          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'P',           -- P | F | FJ
  justification TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, area, person_id, date)
);

-- Broadcasts (mensagem geral)
CREATE TABLE IF NOT EXISTS public.broadcasts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  message       TEXT NOT NULL,
  duration_days INT NOT NULL DEFAULT 1,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ==============================================================
-- 2. FUNÇÕES UTILITÁRIAS
-- ==============================================================

CREATE OR REPLACE FUNCTION public.is_member_of(_user_id UUID, _ws_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = _user_id AND workspace_id = _ws_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_of(_user_id UUID, _ws_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = _user_id AND workspace_id = _ws_id
      AND role IN ('owner', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_owner_of(_user_id UUID, _ws_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = _user_id AND workspace_id = _ws_id AND role = 'owner'
  );
$$;

-- Gera código alfanumérico curto e único para workspace
CREATE OR REPLACE FUNCTION public.generate_workspace_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := 'BUZZ-';
  i INT;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  END LOOP;
  RETURN result;
END;
$$;


-- ==============================================================
-- 3. RPCs USADAS PELO FRONTEND
-- ==============================================================

-- create_workspace
CREATE OR REPLACE FUNCTION public.create_workspace(_name TEXT)
RETURNS SETOF public.workspaces
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _uid UUID := auth.uid();
  _new_ws public.workspaces%ROWTYPE;
  _code TEXT;
  _retries INT := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  LOOP
    _code := public.generate_workspace_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.workspaces WHERE code = _code);
    _retries := _retries + 1;
    IF _retries > 10 THEN RAISE EXCEPTION 'code_generation_failed'; END IF;
  END LOOP;

  INSERT INTO public.workspaces (name, code, owner_user_id)
  VALUES (_name, _code, _uid)
  RETURNING * INTO _new_ws;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (_new_ws.id, _uid, 'owner');

  RETURN NEXT _new_ws;
END;
$$;

-- list_my_workspaces
CREATE OR REPLACE FUNCTION public.list_my_workspaces()
RETURNS TABLE (
  workspace_id UUID,
  name TEXT,
  code TEXT,
  role TEXT,
  created_at TIMESTAMPTZ
) LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT w.id, w.name, w.code, m.role, m.created_at
  FROM public.workspace_members m
  JOIN public.workspaces w ON w.id = m.workspace_id
  WHERE m.user_id = auth.uid()
  ORDER BY m.created_at ASC;
$$;

-- list_my_join_requests
CREATE OR REPLACE FUNCTION public.list_my_join_requests()
RETURNS TABLE (
  id UUID,
  workspace_id UUID,
  workspace_name TEXT,
  workspace_code TEXT,
  status TEXT,
  requested_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  decided_role TEXT
) LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT r.id, r.workspace_id, w.name, w.code, r.status, r.requested_at, r.decided_at, r.decided_role
  FROM public.workspace_join_requests r
  JOIN public.workspaces w ON w.id = r.workspace_id
  WHERE r.user_id = auth.uid()
  ORDER BY r.requested_at DESC;
$$;

-- list_workspace_members (visível para qualquer membro do ws)
CREATE OR REPLACE FUNCTION public.list_workspace_members(_ws_id UUID)
RETURNS TABLE (
  user_id UUID,
  role TEXT,
  created_at TIMESTAMPTZ,
  display_name TEXT,
  email TEXT
) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  IF NOT public.is_member_of(auth.uid(), _ws_id) THEN
    RAISE EXCEPTION 'not_a_member';
  END IF;
  RETURN QUERY
  SELECT m.user_id, m.role, m.created_at,
         COALESCE(p.display_name, p.email, '') AS display_name,
         COALESCE(p.email, '') AS email
  FROM public.workspace_members m
  LEFT JOIN public.profiles p ON p.user_id = m.user_id
  WHERE m.workspace_id = _ws_id
  ORDER BY (CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END), m.created_at;
END;
$$;

-- list_workspace_join_requests (só owner/admin)
CREATE OR REPLACE FUNCTION public.list_workspace_join_requests(_ws_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  display_name TEXT,
  email TEXT,
  status TEXT,
  requested_at TIMESTAMPTZ
) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  IF NOT public.is_admin_of(auth.uid(), _ws_id) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;
  RETURN QUERY
  SELECT r.id, r.user_id,
         COALESCE(p.display_name, p.email, '') AS display_name,
         COALESCE(p.email, '') AS email,
         r.status, r.requested_at
  FROM public.workspace_join_requests r
  LEFT JOIN public.profiles p ON p.user_id = r.user_id
  WHERE r.workspace_id = _ws_id AND r.status = 'pending'
  ORDER BY r.requested_at DESC;
END;
$$;

-- request_join_workspace
CREATE OR REPLACE FUNCTION public.request_join_workspace(_code TEXT)
RETURNS SETOF public.workspace_join_requests
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _uid UUID := auth.uid();
  _ws_id UUID;
  _existing public.workspace_join_requests%ROWTYPE;
  _new public.workspace_join_requests%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT id INTO _ws_id FROM public.workspaces WHERE code = _code;
  IF _ws_id IS NULL THEN RAISE EXCEPTION 'invalid_code'; END IF;

  IF EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = _ws_id AND user_id = _uid) THEN
    RAISE EXCEPTION 'already_member';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.workspace_join_requests
    WHERE workspace_id = _ws_id AND user_id = _uid AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'already_pending';
  END IF;

  INSERT INTO public.workspace_join_requests (workspace_id, user_id, status)
  VALUES (_ws_id, _uid, 'pending')
  RETURNING * INTO _new;

  RETURN NEXT _new;
END;
$$;

-- cancel_join_request
CREATE OR REPLACE FUNCTION public.cancel_join_request(_req_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.workspace_join_requests
     SET status = 'canceled', decided_at = NOW()
   WHERE id = _req_id AND user_id = auth.uid() AND status = 'pending';
END;
$$;

-- approve_join_request
CREATE OR REPLACE FUNCTION public.approve_join_request(_req_id UUID, _role TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE _r public.workspace_join_requests%ROWTYPE;
BEGIN
  SELECT * INTO _r FROM public.workspace_join_requests WHERE id = _req_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT public.is_admin_of(auth.uid(), _r.workspace_id) THEN RAISE EXCEPTION 'not_admin'; END IF;
  IF _role NOT IN ('admin','member','leader') THEN _role := 'member'; END IF;

  UPDATE public.workspace_join_requests
     SET status = 'approved', decided_at = NOW(), decided_by = auth.uid(), decided_role = _role
   WHERE id = _req_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (_r.workspace_id, _r.user_id, _role)
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role;
END;
$$;

-- reject_join_request
CREATE OR REPLACE FUNCTION public.reject_join_request(_req_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE _r public.workspace_join_requests%ROWTYPE;
BEGIN
  SELECT * INTO _r FROM public.workspace_join_requests WHERE id = _req_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT public.is_admin_of(auth.uid(), _r.workspace_id) THEN RAISE EXCEPTION 'not_admin'; END IF;
  UPDATE public.workspace_join_requests
     SET status = 'rejected', decided_at = NOW(), decided_by = auth.uid()
   WHERE id = _req_id;
END;
$$;

-- update_member_role
CREATE OR REPLACE FUNCTION public.update_member_role(_ws_id UUID, _target UUID, _new_role TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT public.is_owner_of(auth.uid(), _ws_id) THEN RAISE EXCEPTION 'not_owner'; END IF;
  IF _new_role NOT IN ('admin','member','leader') THEN RAISE EXCEPTION 'invalid_role'; END IF;
  UPDATE public.workspace_members
     SET role = _new_role
   WHERE workspace_id = _ws_id AND user_id = _target AND role <> 'owner';
END;
$$;

-- remove_workspace_member
CREATE OR REPLACE FUNCTION public.remove_workspace_member(_ws_id UUID, _target UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT public.is_admin_of(auth.uid(), _ws_id) THEN RAISE EXCEPTION 'not_admin'; END IF;
  -- não pode remover owner
  IF EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _ws_id AND user_id = _target AND role = 'owner'
  ) THEN RAISE EXCEPTION 'cannot_remove_owner'; END IF;

  DELETE FROM public.workspace_members
   WHERE workspace_id = _ws_id AND user_id = _target;

  -- desliga a vinculação na tabela people
  UPDATE public.people SET user_id = NULL
   WHERE workspace_id = _ws_id AND user_id = _target;
END;
$$;


-- ==============================================================
-- 4. ROW-LEVEL SECURITY
-- ==============================================================
-- Política: tudo dentro de um workspace é acessível por qualquer membro.
-- INSERT/UPDATE/DELETE liberados para qualquer membro (a UI controla
-- quem pode o quê — mesmo modelo do projeto atual).

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'workspaces','workspace_members','workspace_join_requests','profiles',
    'people','teams','team_members','projects','project_participants',
    'tasks','task_assignees','posts','post_assignees','calendar_items',
    'categories','channels','event_types','area_notes','parking_items',
    'gamification_actions','gamification_awards','lead_thermometer',
    'attendance_settings','attendance_records','broadcasts'
  ]) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- profiles: cada user lê e atualiza o próprio
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT USING (true);
DROP POLICY IF EXISTS profiles_upsert ON public.profiles;
CREATE POLICY profiles_upsert ON public.profiles
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- workspaces: leitura para qualquer authenticated (precisa pra ler por code)
DROP POLICY IF EXISTS ws_select ON public.workspaces;
CREATE POLICY ws_select ON public.workspaces FOR SELECT USING (true);
DROP POLICY IF EXISTS ws_update ON public.workspaces;
CREATE POLICY ws_update ON public.workspaces FOR UPDATE
  USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());

-- workspace_members: read se for membro do workspace
DROP POLICY IF EXISTS wsm_select ON public.workspace_members;
CREATE POLICY wsm_select ON public.workspace_members FOR SELECT
  USING (public.is_member_of(auth.uid(), workspace_id) OR user_id = auth.uid());

-- workspace_join_requests
DROP POLICY IF EXISTS wjr_select ON public.workspace_join_requests;
CREATE POLICY wjr_select ON public.workspace_join_requests FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin_of(auth.uid(), workspace_id));

-- Helper: gera policies "se for membro" para uma tabela qualquer com workspace_id
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'people','teams','team_members','projects','project_participants',
    'tasks','task_assignees','posts','post_assignees','calendar_items',
    'categories','channels','event_types','area_notes','parking_items',
    'gamification_actions','gamification_awards','lead_thermometer',
    'attendance_settings','attendance_records','broadcasts'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_modify ON public.%I', t, t);
  END LOOP;
END $$;

-- people / teams / etc. — todas seguem o mesmo padrão de "se eu sou membro do ws"
-- Para tabelas com workspace_id direto:
CREATE POLICY people_select       ON public.people       FOR SELECT USING (public.is_member_of(auth.uid(), workspace_id));
CREATE POLICY people_modify       ON public.people       FOR ALL    USING (public.is_member_of(auth.uid(), workspace_id)) WITH CHECK (public.is_member_of(auth.uid(), workspace_id));

CREATE POLICY teams_select        ON public.teams        FOR SELECT USING (public.is_member_of(auth.uid(), workspace_id));
CREATE POLICY teams_modify        ON public.teams        FOR ALL    USING (public.is_member_of(auth.uid(), workspace_id)) WITH CHECK (public.is_member_of(auth.uid(), workspace_id));

CREATE POLICY projects_select     ON public.projects     FOR SELECT USING (public.is_member_of(auth.uid(), workspace_id));
CREATE POLICY projects_modify     ON public.projects     FOR ALL    USING (public.is_member_of(auth.uid(), workspace_id)) WITH CHECK (public.is_member_of(auth.uid(), workspace_id));

CREATE POLICY tasks_select        ON public.tasks        FOR SELECT USING (public.is_member_of(auth.uid(), workspace_id));
CREATE POLICY tasks_modify        ON public.tasks        FOR ALL    USING (public.is_member_of(auth.uid(), workspace_id)) WITH CHECK (public.is_member_of(auth.uid(), workspace_id));

CREATE POLICY posts_select        ON public.posts        FOR SELECT USING (public.is_member_of(auth.uid(), workspace_id));
CREATE POLICY posts_modify        ON public.posts        FOR ALL    USING (public.is_member_of(auth.uid(), workspace_id)) WITH CHECK (public.is_member_of(auth.uid(), workspace_id));

CREATE POLICY cal_select          ON public.calendar_items FOR SELECT USING (public.is_member_of(auth.uid(), workspace_id));
CREATE POLICY cal_modify          ON public.calendar_items FOR ALL    USING (public.is_member_of(auth.uid(), workspace_id)) WITH CHECK (public.is_member_of(auth.uid(), workspace_id));

CREATE POLICY cat_select          ON public.categories   FOR SELECT USING (public.is_member_of(auth.uid(), workspace_id));
CREATE POLICY cat_modify          ON public.categories   FOR ALL    USING (public.is_member_of(auth.uid(), workspace_id)) WITH CHECK (public.is_member_of(auth.uid(), workspace_id));

CREATE POLICY ch_select           ON public.channels     FOR SELECT USING (public.is_member_of(auth.uid(), workspace_id));
CREATE POLICY ch_modify           ON public.channels     FOR ALL    USING (public.is_member_of(auth.uid(), workspace_id)) WITH CHECK (public.is_member_of(auth.uid(), workspace_id));

CREATE POLICY et_select           ON public.event_types  FOR SELECT USING (public.is_member_of(auth.uid(), workspace_id));
CREATE POLICY et_modify           ON public.event_types  FOR ALL    USING (public.is_member_of(auth.uid(), workspace_id)) WITH CHECK (public.is_member_of(auth.uid(), workspace_id));

CREATE POLICY an_select           ON public.area_notes   FOR SELECT USING (public.is_member_of(auth.uid(), workspace_id));
CREATE POLICY an_modify           ON public.area_notes   FOR ALL    USING (public.is_member_of(auth.uid(), workspace_id)) WITH CHECK (public.is_member_of(auth.uid(), workspace_id));

CREATE POLICY pi_select           ON public.parking_items FOR SELECT USING (public.is_member_of(auth.uid(), workspace_id));
CREATE POLICY pi_modify           ON public.parking_items FOR ALL    USING (public.is_member_of(auth.uid(), workspace_id)) WITH CHECK (public.is_member_of(auth.uid(), workspace_id));

CREATE POLICY ga_select           ON public.gamification_actions FOR SELECT USING (public.is_member_of(auth.uid(), workspace_id));
CREATE POLICY ga_modify           ON public.gamification_actions FOR ALL    USING (public.is_member_of(auth.uid(), workspace_id)) WITH CHECK (public.is_member_of(auth.uid(), workspace_id));

CREATE POLICY gw_select           ON public.gamification_awards FOR SELECT USING (public.is_member_of(auth.uid(), workspace_id));
CREATE POLICY gw_modify           ON public.gamification_awards FOR ALL    USING (public.is_member_of(auth.uid(), workspace_id)) WITH CHECK (public.is_member_of(auth.uid(), workspace_id));

CREATE POLICY lt_select           ON public.lead_thermometer FOR SELECT USING (public.is_member_of(auth.uid(), workspace_id));
CREATE POLICY lt_modify           ON public.lead_thermometer FOR ALL    USING (public.is_member_of(auth.uid(), workspace_id)) WITH CHECK (public.is_member_of(auth.uid(), workspace_id));

CREATE POLICY as_select           ON public.attendance_settings FOR SELECT USING (public.is_member_of(auth.uid(), workspace_id));
CREATE POLICY as_modify           ON public.attendance_settings FOR ALL    USING (public.is_member_of(auth.uid(), workspace_id)) WITH CHECK (public.is_member_of(auth.uid(), workspace_id));

CREATE POLICY ar_select           ON public.attendance_records FOR SELECT USING (public.is_member_of(auth.uid(), workspace_id));
CREATE POLICY ar_modify           ON public.attendance_records FOR ALL    USING (public.is_member_of(auth.uid(), workspace_id)) WITH CHECK (public.is_member_of(auth.uid(), workspace_id));

CREATE POLICY bc_select           ON public.broadcasts   FOR SELECT USING (public.is_member_of(auth.uid(), workspace_id));
CREATE POLICY bc_modify           ON public.broadcasts   FOR ALL    USING (public.is_member_of(auth.uid(), workspace_id)) WITH CHECK (public.is_member_of(auth.uid(), workspace_id));

-- Junction tables sem workspace_id: deriva pelo pai
CREATE POLICY tm_select  ON public.team_members FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND public.is_member_of(auth.uid(), t.workspace_id)));
CREATE POLICY tm_modify  ON public.team_members FOR ALL
  USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND public.is_member_of(auth.uid(), t.workspace_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND public.is_member_of(auth.uid(), t.workspace_id)));

CREATE POLICY pp_select  ON public.project_participants FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND public.is_member_of(auth.uid(), p.workspace_id)));
CREATE POLICY pp_modify  ON public.project_participants FOR ALL
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND public.is_member_of(auth.uid(), p.workspace_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND public.is_member_of(auth.uid(), p.workspace_id)));

CREATE POLICY ta_select  ON public.task_assignees FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND public.is_member_of(auth.uid(), t.workspace_id)));
CREATE POLICY ta_modify  ON public.task_assignees FOR ALL
  USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND public.is_member_of(auth.uid(), t.workspace_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND public.is_member_of(auth.uid(), t.workspace_id)));

CREATE POLICY pa_select  ON public.post_assignees FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND public.is_member_of(auth.uid(), p.workspace_id)));
CREATE POLICY pa_modify  ON public.post_assignees FOR ALL
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND public.is_member_of(auth.uid(), p.workspace_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND public.is_member_of(auth.uid(), p.workspace_id)));


-- ==============================================================
-- 5. REALTIME — habilitar para todas as tabelas que o frontend escuta
-- ==============================================================

DO $$
DECLARE t TEXT;
BEGIN
  -- Garante que a publication existe (Supabase já cria, mas é defensivo)
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  FOR t IN SELECT unnest(ARRAY[
    'people','tasks','posts','projects','calendar_items',
    'categories','channels','teams','team_members',
    'task_assignees','post_assignees','project_participants','event_types',
    'area_notes','parking_items',
    'gamification_actions','gamification_awards',
    'lead_thermometer','attendance_settings','attendance_records',
    'broadcasts','workspace_members','workspace_join_requests'
  ]) LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN
      -- já está na publication, ignora
      NULL;
    END;
  END LOOP;
END $$;


-- ==============================================================
-- 6. PERMISSÕES (executar as RPCs como usuário authenticated/anon)
-- ==============================================================

GRANT EXECUTE ON FUNCTION public.create_workspace(TEXT)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_workspaces()               TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_join_requests()            TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_workspace_members(UUID)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_workspace_join_requests(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_join_workspace(TEXT)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_join_request(UUID)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_join_request(UUID, TEXT)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_join_request(UUID)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_member_role(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_workspace_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_member_of(UUID, UUID)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_of(UUID, UUID)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner_of(UUID, UUID)            TO authenticated;


-- ==============================================================
-- Fim do schema. ✅
-- ==============================================================
SELECT 'Schema BuzzUp criado com sucesso!' AS status;
