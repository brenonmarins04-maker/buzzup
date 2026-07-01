-- BuzzUp - Portal do Moderador / Analytics Global
-- Seguro para rodar mais de uma vez.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins
    WHERE user_id = auth.uid()
  );
$$;

CREATE TABLE IF NOT EXISTS public.platform_admin_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_admin_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admins_read_config ON public.platform_admin_config;
CREATE POLICY admins_read_config
  ON public.platform_admin_config
  FOR SELECT
  USING (public.is_platform_admin());

CREATE TABLE IF NOT EXISTS public.user_daily_logins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  login_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_daily_logins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS members_insert_own_login ON public.user_daily_logins;
CREATE POLICY members_insert_own_login
  ON public.user_daily_logins
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      WHERE wm.workspace_id = user_daily_logins.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS admins_read_logins ON public.user_daily_logins;
CREATE POLICY admins_read_logins
  ON public.user_daily_logins
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      WHERE wm.workspace_id = user_daily_logins.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin', 'leader')
    )
  );

DROP INDEX IF EXISTS idx_user_daily_logins_last_click;
CREATE INDEX IF NOT EXISTS idx_user_daily_logins_last_click
  ON public.user_daily_logins (workspace_id, user_id, created_at DESC);

ALTER TABLE public.user_daily_logins
  DROP CONSTRAINT IF EXISTS user_daily_logins_workspace_id_user_id_login_date_key;

CREATE TABLE IF NOT EXISTS public.user_workspace_last_seen (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);
ALTER TABLE public.user_workspace_last_seen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS members_manage_own_last_seen ON public.user_workspace_last_seen;
CREATE POLICY members_manage_own_last_seen
  ON public.user_workspace_last_seen
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.platform_funnel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL,
  session_id text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_funnel_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_platform_funnel_events_event_created
  ON public.platform_funnel_events (event_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_funnel_events_user_created
  ON public.platform_funnel_events (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.track_platform_event(
  _event_key text,
  _session_id text DEFAULT NULL,
  _email text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(trim(_event_key), '') = '' THEN
    RETURN;
  END IF;

  IF _event_key NOT IN (
    'landing_view',
    'signup_cta_click',
    'signup_success',
    'workspace_entered',
    'workspace_created',
    'workspace_join_requested'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.platform_funnel_events (
    event_key,
    session_id,
    user_id,
    email,
    metadata
  ) VALUES (
    trim(_event_key),
    NULLIF(trim(_session_id), ''),
    auth.uid(),
    NULLIF(lower(trim(_email)), ''),
    coalesce(_metadata, '{}'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_platform_event(text, text, text, jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_platform_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  v_forms bigint := 0;
  v_logins bigint := 0;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF to_regclass('public.workspace_forms') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.workspace_forms' INTO v_forms;
  END IF;

  IF to_regclass('public.user_daily_logins') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.user_daily_logins' INTO v_logins;
  END IF;

  SELECT json_build_object(
    'workspaces', (SELECT count(*) FROM public.workspaces),
    'usuarios', (SELECT count(*) FROM auth.users),
    'membros', (SELECT count(*) FROM public.workspace_members),
    'pessoas', (SELECT count(*) FROM public.people),
    'demandas', (SELECT count(*) FROM public.parking_items),
    'demandas_concluidas', (SELECT count(*) FROM public.parking_items WHERE status = 'done'),
    'formularios', v_forms,
    'entradas_registradas', v_logins
  ) INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_workspaces()
RETURNS TABLE(
  id uuid,
  name text,
  code text,
  created_at timestamptz,
  owner_email text,
  membros bigint,
  demandas bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    w.id,
    w.name,
    w.code,
    w.created_at,
    (
      SELECT coalesce(p.email, u.email::text)
      FROM public.workspace_members m
      LEFT JOIN public.profiles p ON p.user_id = m.user_id
      LEFT JOIN auth.users u ON u.id = m.user_id
      WHERE m.workspace_id = w.id
        AND m.role = 'owner'
      ORDER BY m.created_at ASC
      LIMIT 1
    ) AS owner_email,
    (SELECT count(*) FROM public.workspace_members m2 WHERE m2.workspace_id = w.id) AS membros,
    (SELECT count(*) FROM public.parking_items pi WHERE pi.workspace_id = w.id) AS demandas
  FROM public.workspaces w
  ORDER BY w.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(
  user_id uuid,
  display_name text,
  email text,
  created_at timestamptz,
  workspaces bigint,
  pessoas bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    coalesce(nullif(trim(p.display_name), ''), split_part(u.email::text, '@', 1)) AS display_name,
    u.email::text AS email,
    u.created_at,
    (SELECT count(*) FROM public.workspace_members wm WHERE wm.user_id = u.id) AS workspaces,
    (SELECT count(*) FROM public.people pe WHERE pe.user_id = u.id) AS pessoas
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_demands()
RETURNS TABLE(
  id uuid,
  workspace_name text,
  area text,
  responsible_name text,
  responsible_email text,
  title text,
  status text,
  due_date text,
  completed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    pi.id,
    w.name AS workspace_name,
    pi.area,
    coalesce(pe.name, 'Sem responsável') AS responsible_name,
    (
      SELECT coalesce(pr.email, au.email::text)
      FROM auth.users au
      LEFT JOIN public.profiles pr ON pr.user_id = au.id
      WHERE au.id = pe.user_id
      LIMIT 1
    ) AS responsible_email,
    pi.title,
    coalesce(pi.status, 'in-progress') AS status,
    coalesce(pi.date, '') AS due_date,
    pi.completed_at
  FROM public.parking_items pi
  JOIN public.workspaces w ON w.id = pi.workspace_id
  LEFT JOIN public.people pe ON pe.id = pi.person_id
  ORDER BY coalesce(pi.completed_at, pi.created_at, now()) DESC, w.name ASC, pi.title ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_global_logins(_limit integer DEFAULT 500)
RETURNS TABLE(
  workspace_name text,
  user_name text,
  user_email text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    w.name AS workspace_name,
    coalesce(nullif(trim(p.display_name), ''), split_part(coalesce(p.email, u.email::text), '@', 1), 'Usuário') AS user_name,
    coalesce(p.email, u.email::text, 'Sem e-mail') AS user_email,
    l.created_at
  FROM public.user_daily_logins l
  JOIN public.workspaces w ON w.id = l.workspace_id
  LEFT JOIN public.profiles p ON p.user_id = l.user_id
  LEFT JOIN auth.users u ON u.id = l.user_id
  ORDER BY l.created_at DESC
  LIMIT greatest(coalesce(_limit, 500), 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_platform_funnel()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT json_build_object(
    'landing_views_total', (SELECT count(*) FROM public.platform_funnel_events WHERE event_key = 'landing_view'),
    'landing_views_unique_sessions', (SELECT count(DISTINCT session_id) FROM public.platform_funnel_events WHERE event_key = 'landing_view' AND session_id IS NOT NULL),
    'signup_clicks_total', (SELECT count(*) FROM public.platform_funnel_events WHERE event_key = 'signup_cta_click'),
    'signup_clicks_unique_sessions', (SELECT count(DISTINCT session_id) FROM public.platform_funnel_events WHERE event_key = 'signup_cta_click' AND session_id IS NOT NULL),
    'signup_success_total', (SELECT count(*) FROM public.platform_funnel_events WHERE event_key = 'signup_success'),
    'signup_success_unique_users', (SELECT count(DISTINCT coalesce(user_id::text, email)) FROM public.platform_funnel_events WHERE event_key = 'signup_success'),
    'workspace_entries_total', (SELECT count(*) FROM public.user_daily_logins),
    'workspace_entries_unique_users', (SELECT count(DISTINCT user_id) FROM public.user_daily_logins),
    'workspace_creations_total', (
      SELECT coalesce(nullif((SELECT count(*) FROM public.platform_funnel_events WHERE event_key = 'workspace_created'), 0), (SELECT count(*) FROM public.workspaces))
    ),
    'workspace_join_requests_total', (SELECT count(*) FROM public.workspace_join_requests)
  ) INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_platform_funnel_events(_limit integer DEFAULT 500)
RETURNS TABLE(
  event_key text,
  user_name text,
  user_email text,
  workspace_name text,
  source text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    e.event_key,
    coalesce(nullif(trim(p.display_name), ''), split_part(coalesce(e.email, u.email::text, 'Usuário'), '@', 1), 'Usuário') AS user_name,
    coalesce(e.email, p.email, u.email::text, 'Sem e-mail') AS user_email,
    coalesce(w.name, '') AS workspace_name,
    coalesce(e.metadata->>'source', e.metadata->>'path', '') AS source,
    e.created_at
  FROM public.platform_funnel_events e
  LEFT JOIN public.profiles p ON p.user_id = e.user_id
  LEFT JOIN auth.users u ON u.id = e.user_id
  LEFT JOIN public.workspaces w ON w.id = nullif(e.metadata->>'workspace_id', '')::uuid
  ORDER BY e.created_at DESC
  LIMIT greatest(coalesce(_limit, 500), 1);
END;
$$;
