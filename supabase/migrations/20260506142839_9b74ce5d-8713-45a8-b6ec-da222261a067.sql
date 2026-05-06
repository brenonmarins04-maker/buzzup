
GRANT EXECUTE ON FUNCTION public.get_workspace_id(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_workspace_admin(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.redeem_access_code(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_access_code() TO authenticated, anon, service_role;
