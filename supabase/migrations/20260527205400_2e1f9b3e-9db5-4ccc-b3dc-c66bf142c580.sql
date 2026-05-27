
-- 1. Drop overly permissive calendar_items policy (admins_write_calendar_items already covers admin writes)
DROP POLICY IF EXISTS "Users manage own calendar items" ON public.calendar_items;

-- 2. Restrict workspace_invites SELECT to admins only
DROP POLICY IF EXISTS "members_select_workspace_invites" ON public.workspace_invites;
CREATE POLICY "admins_select_workspace_invites"
ON public.workspace_invites
FOR SELECT
TO authenticated
USING ((workspace_id = get_workspace_id(auth.uid())) AND is_workspace_admin(auth.uid()));

-- 3. Make get_workspace_id deterministic
CREATE OR REPLACE FUNCTION public.get_workspace_id(_user_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT workspace_id FROM public.workspace_members
  WHERE user_id = _user_id
  ORDER BY created_at ASC, workspace_id ASC
  LIMIT 1;
$function$;

-- 4. Revoke EXECUTE on internal SECURITY DEFINER helpers from API roles
REVOKE EXECUTE ON FUNCTION public.get_workspace_id(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_workspace_admin(uuid) FROM anon, authenticated, public;

-- 5. Realtime: deny all broadcast/presence channel access by default.
-- The app uses postgres_changes (governed by table RLS), not broadcast/presence.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_all_realtime_messages_select" ON realtime.messages;
DROP POLICY IF EXISTS "deny_all_realtime_messages_insert" ON realtime.messages;

CREATE POLICY "deny_all_realtime_messages_select"
ON realtime.messages
FOR SELECT
TO authenticated
USING (false);

CREATE POLICY "deny_all_realtime_messages_insert"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (false);
