-- Update handle_new_user so workspace creators are added as Admin in People
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
  _name := COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name',''), split_part(NEW.email, '@', 1));

  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, _name);

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

    INSERT INTO public.people (workspace_id, name, email, role, user_id)
    VALUES (_ws_id, _name, lower(NEW.email), 'admin', NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill existing workspace creators as People (admin) if they aren't already
INSERT INTO public.people (workspace_id, name, email, role, user_id)
SELECT w.id,
       COALESCE(NULLIF(p.display_name,''), split_part(u.email, '@', 1)),
       lower(u.email),
       'admin',
       w.user_id
FROM public.workspaces w
JOIN auth.users u ON u.id = w.user_id
LEFT JOIN public.profiles p ON p.user_id = w.user_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.people pe
  WHERE pe.workspace_id = w.id AND pe.user_id = w.user_id
);
