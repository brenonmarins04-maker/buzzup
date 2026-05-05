
-- people: add invite_status + role/email constraints
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS invite_status text NOT NULL DEFAULT 'not_sent';
ALTER TABLE public.people DROP CONSTRAINT IF EXISTS people_role_check;
ALTER TABLE public.people ADD CONSTRAINT people_role_check CHECK (role IN ('admin','member'));
ALTER TABLE public.people DROP CONSTRAINT IF EXISTS people_invite_status_check;
ALTER TABLE public.people ADD CONSTRAINT people_invite_status_check CHECK (invite_status IN ('not_sent','pending','accepted','expired','canceled','error'));

-- workspace_invites: add lifecycle columns + person_id link
ALTER TABLE public.workspace_invites
  ADD COLUMN IF NOT EXISTS person_id uuid,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_sent_at timestamptz;

ALTER TABLE public.workspace_invites DROP CONSTRAINT IF EXISTS workspace_invites_role_check;
ALTER TABLE public.workspace_invites ADD CONSTRAINT workspace_invites_role_check CHECK (role IN ('admin','member'));
ALTER TABLE public.workspace_invites DROP CONSTRAINT IF EXISTS workspace_invites_status_check;
ALTER TABLE public.workspace_invites ADD CONSTRAINT workspace_invites_status_check CHECK (status IN ('pending','accepted','expired','canceled','error'));

-- Adjust expires_at default to 7 days
ALTER TABLE public.workspace_invites ALTER COLUMN expires_at SET DEFAULT (now() + interval '7 days');

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS workspace_invites_token_unique ON public.workspace_invites(token);
CREATE INDEX IF NOT EXISTS workspace_invites_workspace_idx ON public.workspace_invites(workspace_id);
CREATE INDEX IF NOT EXISTS workspace_invites_email_idx ON public.workspace_invites(lower(email));
CREATE INDEX IF NOT EXISTS workspace_invites_status_idx ON public.workspace_invites(status);
CREATE UNIQUE INDEX IF NOT EXISTS workspace_invites_unique_pending
  ON public.workspace_invites(workspace_id, lower(email))
  WHERE status = 'pending';

-- workspace_members indexes
CREATE INDEX IF NOT EXISTS workspace_members_user_idx ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS workspace_members_workspace_idx ON public.workspace_members(workspace_id);
ALTER TABLE public.workspace_members DROP CONSTRAINT IF EXISTS workspace_members_role_check;
ALTER TABLE public.workspace_members ADD CONSTRAINT workspace_members_role_check CHECK (role IN ('admin','member'));
ALTER TABLE public.workspace_members DROP CONSTRAINT IF EXISTS workspace_members_unique;
ALTER TABLE public.workspace_members ADD CONSTRAINT workspace_members_unique UNIQUE (workspace_id, user_id);

-- Allow members of same workspace to see other members
DROP POLICY IF EXISTS "Members can view workspace peers" ON public.workspace_members;
CREATE POLICY "Members can view workspace peers" ON public.workspace_members
FOR SELECT TO authenticated
USING (workspace_id = public.get_workspace_id(auth.uid()));

-- Refactor handle_new_user to use new invite/people flow
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _invite public.workspace_invites%ROWTYPE;
  _ws_id uuid;
  _name text;
BEGIN
  _name := COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1));

  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, _name)
  ON CONFLICT DO NOTHING;

  SELECT * INTO _invite
  FROM public.workspace_invites
  WHERE lower(email) = lower(NEW.email)
    AND status = 'pending'
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF _invite.id IS NOT NULL THEN
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (_invite.workspace_id, NEW.id, _invite.role)
    ON CONFLICT (workspace_id, user_id) DO NOTHING;

    UPDATE public.workspace_invites
      SET status = 'accepted', accepted_at = now()
      WHERE id = _invite.id;

    UPDATE public.people
      SET user_id = NEW.id, invite_status = 'accepted'
      WHERE workspace_id = _invite.workspace_id
        AND lower(email) = lower(NEW.email);
  ELSE
    INSERT INTO public.workspaces (user_id, name)
    VALUES (NEW.id, 'Meu Workspace')
    RETURNING id INTO _ws_id;

    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (_ws_id, NEW.id, 'admin')
    ON CONFLICT (workspace_id, user_id) DO NOTHING;

    INSERT INTO public.people (workspace_id, name, email, role, user_id, invite_status)
    VALUES (_ws_id, _name, lower(NEW.email), 'admin', NEW.id, 'accepted')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Refactor accept_invite to handle full lifecycle
CREATE OR REPLACE FUNCTION public.accept_invite(_token uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _invite public.workspace_invites%ROWTYPE;
  _email text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT email INTO _email FROM auth.users WHERE id = auth.uid();

  SELECT * INTO _invite FROM public.workspace_invites WHERE token = _token LIMIT 1;
  IF _invite.id IS NULL THEN RAISE EXCEPTION 'invite_not_found'; END IF;
  IF _invite.status = 'accepted' THEN RAISE EXCEPTION 'invite_already_accepted'; END IF;
  IF _invite.status = 'canceled' THEN RAISE EXCEPTION 'invite_canceled'; END IF;
  IF _invite.expires_at <= now() THEN
    UPDATE public.workspace_invites SET status = 'expired' WHERE id = _invite.id;
    RAISE EXCEPTION 'invite_expired';
  END IF;
  IF _invite.status <> 'pending' THEN RAISE EXCEPTION 'invite_invalid'; END IF;
  IF lower(_invite.email) <> lower(_email) THEN RAISE EXCEPTION 'invite_email_mismatch'; END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (_invite.workspace_id, auth.uid(), _invite.role)
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  UPDATE public.workspace_invites SET status = 'accepted', accepted_at = now() WHERE id = _invite.id;

  UPDATE public.people SET user_id = auth.uid(), invite_status = 'accepted'
   WHERE workspace_id = _invite.workspace_id AND lower(email) = lower(_email);

  RETURN _invite.workspace_id;
END;
$$;

-- Public lookup of invite by token (for login page) - SECURITY DEFINER, returns minimal data
CREATE OR REPLACE FUNCTION public.get_invite_by_token(_token uuid)
RETURNS TABLE(email text, role text, status text, expires_at timestamptz, workspace_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT i.email, i.role, i.status, i.expires_at, w.name
  FROM public.workspace_invites i
  JOIN public.workspaces w ON w.id = i.workspace_id
  WHERE i.token = _token
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_invite_by_token(uuid) TO anon, authenticated;
