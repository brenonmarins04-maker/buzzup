
REVOKE EXECUTE ON FUNCTION public.create_workspace(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.create_workspace_invite(uuid, text, integer, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.accept_workspace_invite(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.revoke_workspace_invite(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.remove_workspace_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.update_member_role(uuid, uuid, text) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.create_workspace(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_workspace_invite(uuid, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_workspace_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_workspace_invite(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_workspace_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_member_role(uuid, uuid, text) TO authenticated;
