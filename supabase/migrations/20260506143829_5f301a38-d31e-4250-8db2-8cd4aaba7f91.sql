
CREATE OR REPLACE FUNCTION public.demote_self_to_viewer()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  UPDATE public.workspace_members
    SET role = 'viewer'
    WHERE user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.demote_self_to_viewer() TO authenticated;
