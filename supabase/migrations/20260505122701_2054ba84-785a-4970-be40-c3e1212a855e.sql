
-- 1. Add fields to people
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS user_id uuid;

-- 2. workspace_members
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own memberships" ON public.workspace_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 3. workspace_invites
CREATE TABLE IF NOT EXISTS public.workspace_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  invited_by uuid,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage workspace invites" ON public.workspace_invites
  FOR ALL TO authenticated
  USING (workspace_id = public.get_workspace_id(auth.uid()))
  WITH CHECK (workspace_id = public.get_workspace_id(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_invites_email ON public.workspace_invites (lower(email));

-- 4. Backfill workspace_members from existing workspaces
INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT id, user_id, 'admin' FROM public.workspaces
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- 5. Update get_workspace_id to read from membership
CREATE OR REPLACE FUNCTION public.get_workspace_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT workspace_id FROM public.workspace_members WHERE user_id = _user_id LIMIT 1;
$$;

-- 6. Update handle_new_user to honor pending invites
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _invite public.workspace_invites%ROWTYPE;
  _ws_id uuid;
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', ''));

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

    UPDATE public.workspace_invites SET status = 'accepted' WHERE id = _invite.id;

    UPDATE public.people
      SET user_id = NEW.id
      WHERE workspace_id = _invite.workspace_id
        AND lower(email) = lower(NEW.email)
        AND user_id IS NULL;
  ELSE
    INSERT INTO public.workspaces (user_id, name)
    VALUES (NEW.id, 'Meu Workspace')
    RETURNING id INTO _ws_id;

    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (_ws_id, NEW.id, 'admin');
  END IF;

  RETURN NEW;
END;
$$;

-- 7. Ensure trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
