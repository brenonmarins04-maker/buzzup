
-- 1) Remove legacy access_code system that allowed any workspace member to read the code and self-promote to admin
ALTER TABLE public.workspaces DROP COLUMN IF EXISTS access_code;
DROP FUNCTION IF EXISTS public.generate_access_code();

-- 2) Lock down workspace_members: explicit restrictive deny on direct writes.
-- All membership mutations must flow through SECURITY DEFINER RPCs
-- (create_workspace, accept_workspace_invite, remove_workspace_member, update_member_role).
DROP POLICY IF EXISTS "deny_direct_insert_workspace_members" ON public.workspace_members;
DROP POLICY IF EXISTS "deny_direct_update_workspace_members" ON public.workspace_members;
DROP POLICY IF EXISTS "deny_direct_delete_workspace_members" ON public.workspace_members;

CREATE POLICY "deny_direct_insert_workspace_members"
  ON public.workspace_members AS RESTRICTIVE
  FOR INSERT TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "deny_direct_update_workspace_members"
  ON public.workspace_members AS RESTRICTIVE
  FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);

CREATE POLICY "deny_direct_delete_workspace_members"
  ON public.workspace_members AS RESTRICTIVE
  FOR DELETE TO authenticated, anon
  USING (false);

-- 3) Same hardening for workspace_invites: SELECT is allowed for admins via existing policy,
-- but all writes must go through RPCs (create/revoke/accept).
DROP POLICY IF EXISTS "deny_direct_insert_workspace_invites" ON public.workspace_invites;
DROP POLICY IF EXISTS "deny_direct_update_workspace_invites" ON public.workspace_invites;
DROP POLICY IF EXISTS "deny_direct_delete_workspace_invites" ON public.workspace_invites;

CREATE POLICY "deny_direct_insert_workspace_invites"
  ON public.workspace_invites AS RESTRICTIVE
  FOR INSERT TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "deny_direct_update_workspace_invites"
  ON public.workspace_invites AS RESTRICTIVE
  FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);

CREATE POLICY "deny_direct_delete_workspace_invites"
  ON public.workspace_invites AS RESTRICTIVE
  FOR DELETE TO authenticated, anon
  USING (false);

-- 4) Same for activity_logs: only admins read (existing); writes only via SECURITY DEFINER RPCs.
DROP POLICY IF EXISTS "deny_direct_insert_activity_logs" ON public.activity_logs;
DROP POLICY IF EXISTS "deny_direct_update_activity_logs" ON public.activity_logs;
DROP POLICY IF EXISTS "deny_direct_delete_activity_logs" ON public.activity_logs;

CREATE POLICY "deny_direct_insert_activity_logs"
  ON public.activity_logs AS RESTRICTIVE
  FOR INSERT TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "deny_direct_update_activity_logs"
  ON public.activity_logs AS RESTRICTIVE
  FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);

CREATE POLICY "deny_direct_delete_activity_logs"
  ON public.activity_logs AS RESTRICTIVE
  FOR DELETE TO authenticated, anon
  USING (false);
