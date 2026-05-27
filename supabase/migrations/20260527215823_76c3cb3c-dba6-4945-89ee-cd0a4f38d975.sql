GRANT EXECUTE ON FUNCTION public.get_workspace_id(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_admin(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.demote_self_to_viewer() TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_access_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invite_by_token(uuid) TO authenticated, anon;