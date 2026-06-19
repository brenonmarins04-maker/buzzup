-- ================================================================
-- BuzzUp — APENAS funções e grants (tabelas e RLS já existem)
-- Cole isso no SQL Editor do Supabase e clique Run ▶
-- ================================================================

-- Funções utilitárias
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

-- RPCs do frontend
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

CREATE OR REPLACE FUNCTION public.list_my_workspaces()
RETURNS TABLE (
  workspace_id UUID, name TEXT, code TEXT, role TEXT, created_at TIMESTAMPTZ
) LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT w.id, w.name, w.code, m.role, m.created_at
  FROM public.workspace_members m
  JOIN public.workspaces w ON w.id = m.workspace_id
  WHERE m.user_id = auth.uid()
  ORDER BY m.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.list_my_join_requests()
RETURNS TABLE (
  id UUID, workspace_id UUID, workspace_name TEXT, workspace_code TEXT,
  status TEXT, requested_at TIMESTAMPTZ, decided_at TIMESTAMPTZ, decided_role TEXT
) LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT r.id, r.workspace_id, w.name, w.code, r.status, r.requested_at, r.decided_at, r.decided_role
  FROM public.workspace_join_requests r
  JOIN public.workspaces w ON w.id = r.workspace_id
  WHERE r.user_id = auth.uid()
  ORDER BY r.requested_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.list_workspace_members(_ws_id UUID)
RETURNS TABLE (
  user_id UUID, role TEXT, created_at TIMESTAMPTZ, display_name TEXT, email TEXT
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

CREATE OR REPLACE FUNCTION public.list_workspace_join_requests(_ws_id UUID)
RETURNS TABLE (
  id UUID, user_id UUID, display_name TEXT, email TEXT, status TEXT, requested_at TIMESTAMPTZ
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

CREATE OR REPLACE FUNCTION public.request_join_workspace(_code TEXT)
RETURNS SETOF public.workspace_join_requests
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _uid UUID := auth.uid();
  _ws_id UUID;
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

CREATE OR REPLACE FUNCTION public.cancel_join_request(_req_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.workspace_join_requests
     SET status = 'canceled', decided_at = NOW()
   WHERE id = _req_id AND user_id = auth.uid() AND status = 'pending';
END;
$$;

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

CREATE OR REPLACE FUNCTION public.remove_workspace_member(_ws_id UUID, _target UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT public.is_admin_of(auth.uid(), _ws_id) THEN RAISE EXCEPTION 'not_admin'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _ws_id AND user_id = _target AND role = 'owner'
  ) THEN RAISE EXCEPTION 'cannot_remove_owner'; END IF;
  DELETE FROM public.workspace_members WHERE workspace_id = _ws_id AND user_id = _target;
  UPDATE public.people SET user_id = NULL WHERE workspace_id = _ws_id AND user_id = _target;
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION public.create_workspace(TEXT)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_workspaces()                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_join_requests()              TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_workspace_members(UUID)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_workspace_join_requests(UUID)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_join_workspace(TEXT)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_join_request(UUID)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_join_request(UUID, TEXT)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_join_request(UUID)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_member_role(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_workspace_member(UUID, UUID)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_member_of(UUID, UUID)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_of(UUID, UUID)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner_of(UUID, UUID)              TO authenticated;

SELECT 'Funções criadas com sucesso!' AS status;
