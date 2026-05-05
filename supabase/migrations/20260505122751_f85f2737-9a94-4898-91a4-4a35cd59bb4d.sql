
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
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT email INTO _email FROM auth.users WHERE id = auth.uid();

  SELECT * INTO _invite FROM public.workspace_invites
   WHERE token = _token AND status = 'pending' AND expires_at > now()
   LIMIT 1;

  IF _invite.id IS NULL THEN RAISE EXCEPTION 'invite not found or expired'; END IF;
  IF lower(_invite.email) <> lower(_email) THEN RAISE EXCEPTION 'invite email mismatch'; END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (_invite.workspace_id, auth.uid(), _invite.role)
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  UPDATE public.workspace_invites SET status = 'accepted' WHERE id = _invite.id;

  UPDATE public.people SET user_id = auth.uid()
   WHERE workspace_id = _invite.workspace_id AND lower(email) = lower(_email) AND user_id IS NULL;

  RETURN _invite.workspace_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_workspace_id(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invite(uuid) TO authenticated;
