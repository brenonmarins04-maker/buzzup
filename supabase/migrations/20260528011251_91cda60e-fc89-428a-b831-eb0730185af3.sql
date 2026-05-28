
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.workspace_members
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('active','removed','pending'));

ALTER TABLE public.workspace_members
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.workspace_members
  ADD COLUMN IF NOT EXISTS created_by uuid;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='workspace_members_workspace_user_unique') THEN
    ALTER TABLE public.workspace_members
      ADD CONSTRAINT workspace_members_workspace_user_unique UNIQUE (workspace_id, user_id);
  END IF;
END $$;

REVOKE INSERT, UPDATE, DELETE ON public.workspace_members FROM authenticated;
GRANT SELECT ON public.workspace_members TO authenticated;
GRANT ALL ON public.workspace_members TO service_role;

CREATE OR REPLACE FUNCTION public.get_workspace_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT workspace_id FROM public.workspace_members
   WHERE user_id = _user_id AND status = 'active'
   ORDER BY created_at ASC, workspace_id ASC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = _user_id
      AND workspace_id = public.get_workspace_id(_user_id)
      AND status = 'active'
      AND role IN ('owner','admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_owner(_user_id uuid, _workspace_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = _user_id AND workspace_id = _workspace_id
      AND status = 'active' AND role = 'owner'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_workspace_role(_workspace_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.workspace_members
   WHERE user_id = auth.uid() AND workspace_id = _workspace_id AND status = 'active' LIMIT 1;
$$;

DROP FUNCTION IF EXISTS public.redeem_access_code(text);
DROP FUNCTION IF EXISTS public.demote_self_to_viewer();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _name text;
BEGIN
  _name := COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1));
  INSERT INTO public.profiles (user_id, display_name) VALUES (NEW.id, _name) ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

DROP FUNCTION IF EXISTS public.get_invite_by_token(uuid);
DROP FUNCTION IF EXISTS public.accept_invite(uuid);
DROP TABLE IF EXISTS public.workspace_invites CASCADE;

CREATE TABLE public.workspace_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','member')),
  created_by uuid REFERENCES auth.users(id),
  expires_at timestamptz NOT NULL,
  max_uses integer NOT NULL DEFAULT 1,
  used_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','used','expired','revoked')),
  used_by uuid REFERENCES auth.users(id),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX workspace_invites_workspace_idx ON public.workspace_invites (workspace_id, status);
GRANT SELECT ON public.workspace_invites TO authenticated;
GRANT ALL ON public.workspace_invites TO service_role;
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read invites" ON public.workspace_invites FOR SELECT TO authenticated
USING (workspace_id = public.get_workspace_id(auth.uid()) AND public.is_workspace_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  target_type text,
  target_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read logs" ON public.activity_logs FOR SELECT TO authenticated
USING (workspace_id = public.get_workspace_id(auth.uid()) AND public.is_workspace_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; result text := 'BUZZ-'; i int;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, 1 + floor(random()*length(chars))::int, 1);
  END LOOP;
  RETURN result;
END; $$;

CREATE OR REPLACE FUNCTION public.create_workspace(_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ws_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF coalesce(trim(_name), '') = '' THEN RAISE EXCEPTION 'invalid_name'; END IF;
  INSERT INTO public.workspaces (user_id, name) VALUES (auth.uid(), trim(_name)) RETURNING id INTO _ws_id;
  INSERT INTO public.workspace_members (workspace_id, user_id, role, status, created_by)
  VALUES (_ws_id, auth.uid(), 'owner', 'active', auth.uid());
  INSERT INTO public.activity_logs (workspace_id, user_id, action, target_type, target_id)
  VALUES (_ws_id, auth.uid(), 'workspace_created', 'workspace', _ws_id);
  RETURN _ws_id;
END; $$;

CREATE OR REPLACE FUNCTION public.create_workspace_invite(
  _workspace_id uuid, _role text, _expires_in_hours integer DEFAULT 24, _max_uses integer DEFAULT 1
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _my_role text; _code text; _hash text; _hours integer; _uses integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _role NOT IN ('admin','member') THEN RAISE EXCEPTION 'invalid_role'; END IF;
  SELECT role INTO _my_role FROM public.workspace_members
   WHERE user_id = auth.uid() AND workspace_id = _workspace_id AND status = 'active';
  IF _my_role IS NULL THEN RAISE EXCEPTION 'not_member'; END IF;
  IF _role = 'admin' AND _my_role <> 'owner' THEN RAISE EXCEPTION 'only_owner_invites_admin'; END IF;
  IF _role = 'member' AND _my_role NOT IN ('owner','admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _role = 'admin' THEN
    _hours := LEAST(GREATEST(COALESCE(_expires_in_hours,1),1), 24); _uses := 1;
  ELSE
    _hours := GREATEST(1, LEAST(COALESCE(_expires_in_hours, 24), 24*7));
    _uses := GREATEST(1, LEAST(COALESCE(_max_uses, 1), 50));
  END IF;
  _code := public.generate_invite_code();
  _hash := crypt(_code, gen_salt('bf'));
  INSERT INTO public.workspace_invites
    (workspace_id, code_hash, role, created_by, expires_at, max_uses, used_count, status)
  VALUES
    (_workspace_id, _hash, _role, auth.uid(), now() + make_interval(hours => _hours), _uses, 0, 'active');
  INSERT INTO public.activity_logs (workspace_id, user_id, action, target_type, metadata)
  VALUES (_workspace_id, auth.uid(), 'invite_created', 'invite',
          jsonb_build_object('role', _role, 'expires_in_hours', _hours, 'max_uses', _uses));
  RETURN _code;
END; $$;

CREATE OR REPLACE FUNCTION public.accept_workspace_invite(_code text)
RETURNS TABLE(workspace_id uuid, role text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _inv public.workspace_invites%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF coalesce(trim(_code), '') = '' THEN RAISE EXCEPTION 'invalid_code'; END IF;
  SELECT * INTO _inv FROM public.workspace_invites
   WHERE status = 'active' AND expires_at > now() AND used_count < max_uses
     AND code_hash = crypt(trim(_code), code_hash)
   ORDER BY created_at DESC LIMIT 1;
  IF _inv.id IS NULL THEN RAISE EXCEPTION 'invalid_code'; END IF;
  IF EXISTS (SELECT 1 FROM public.workspace_members
              WHERE workspace_id = _inv.workspace_id AND user_id = auth.uid() AND status = 'active') THEN
    RAISE EXCEPTION 'already_member';
  END IF;
  INSERT INTO public.workspace_members (workspace_id, user_id, role, status, created_by)
  VALUES (_inv.workspace_id, auth.uid(), _inv.role, 'active', _inv.created_by)
  ON CONFLICT (workspace_id, user_id)
    DO UPDATE SET role = EXCLUDED.role, status = 'active', updated_at = now();
  UPDATE public.workspace_invites
     SET used_count = used_count + 1,
         used_by = COALESCE(used_by, auth.uid()),
         used_at = COALESCE(used_at, now()),
         status = CASE WHEN used_count + 1 >= max_uses THEN 'used' ELSE status END,
         updated_at = now()
   WHERE id = _inv.id;
  INSERT INTO public.activity_logs (workspace_id, user_id, action, target_type, target_id, metadata)
  VALUES (_inv.workspace_id, auth.uid(), 'invite_used', 'invite', _inv.id, jsonb_build_object('role', _inv.role));
  RETURN QUERY SELECT _inv.workspace_id, _inv.role;
END; $$;

CREATE OR REPLACE FUNCTION public.revoke_workspace_invite(_workspace_id uuid, _invite_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _my_role text; _inv public.workspace_invites%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT role INTO _my_role FROM public.workspace_members
   WHERE user_id = auth.uid() AND workspace_id = _workspace_id AND status = 'active';
  IF _my_role IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO _inv FROM public.workspace_invites WHERE id = _invite_id AND workspace_id = _workspace_id;
  IF _inv.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF _inv.status <> 'active' THEN RETURN; END IF;
  IF _my_role = 'admin' THEN
    IF _inv.role <> 'member' OR _inv.created_by <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  ELSIF _my_role <> 'owner' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.workspace_invites SET status = 'revoked', updated_at = now() WHERE id = _invite_id;
  INSERT INTO public.activity_logs (workspace_id, user_id, action, target_type, target_id)
  VALUES (_workspace_id, auth.uid(), 'invite_revoked', 'invite', _invite_id);
END; $$;

CREATE OR REPLACE FUNCTION public.remove_workspace_member(_workspace_id uuid, _target_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _my_role text; _target_role text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT role INTO _my_role FROM public.workspace_members
   WHERE user_id = auth.uid() AND workspace_id = _workspace_id AND status = 'active';
  IF _my_role IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT role INTO _target_role FROM public.workspace_members
   WHERE user_id = _target_user AND workspace_id = _workspace_id AND status = 'active';
  IF _target_role IS NULL THEN RETURN; END IF;
  IF _target_role = 'owner' THEN RAISE EXCEPTION 'cannot_remove_owner'; END IF;
  IF _my_role = 'admin' AND _target_role <> 'member' THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _my_role NOT IN ('owner','admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM public.workspace_members WHERE workspace_id = _workspace_id AND user_id = _target_user;
  INSERT INTO public.activity_logs (workspace_id, user_id, action, target_type, target_id, metadata)
  VALUES (_workspace_id, auth.uid(), 'member_removed', 'user', _target_user, jsonb_build_object('previous_role', _target_role));
END; $$;

CREATE OR REPLACE FUNCTION public.update_member_role(_workspace_id uuid, _target_user uuid, _new_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _my_role text; _target_role text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _new_role NOT IN ('admin','member') THEN RAISE EXCEPTION 'invalid_role'; END IF;
  SELECT role INTO _my_role FROM public.workspace_members
   WHERE user_id = auth.uid() AND workspace_id = _workspace_id AND status = 'active';
  IF _my_role <> 'owner' THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT role INTO _target_role FROM public.workspace_members
   WHERE user_id = _target_user AND workspace_id = _workspace_id AND status = 'active';
  IF _target_role IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF _target_role = 'owner' THEN RAISE EXCEPTION 'cannot_change_owner'; END IF;
  IF _target_role = _new_role THEN RETURN; END IF;
  UPDATE public.workspace_members SET role = _new_role, updated_at = now()
   WHERE workspace_id = _workspace_id AND user_id = _target_user;
  INSERT INTO public.activity_logs (workspace_id, user_id, action, target_type, target_id, metadata)
  VALUES (_workspace_id, auth.uid(),
          CASE WHEN _new_role='admin' THEN 'member_promoted_to_admin' ELSE 'admin_demoted_to_member' END,
          'user', _target_user, jsonb_build_object('previous_role', _target_role, 'new_role', _new_role));
END; $$;
