
-- Broadcasts: owner-only writes
DROP POLICY IF EXISTS br_w ON public.broadcasts;
CREATE POLICY br_w ON public.broadcasts
  FOR ALL TO authenticated
  USING (public.is_owner_of(auth.uid(), workspace_id))
  WITH CHECK (public.is_owner_of(auth.uid(), workspace_id));

-- Parking items (CB board demandas): members can INSERT, admins manage everything else
DROP POLICY IF EXISTS pi_w ON public.parking_items;

CREATE POLICY pi_insert_members ON public.parking_items
  FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of(auth.uid(), workspace_id));

CREATE POLICY pi_update_admins ON public.parking_items
  FOR UPDATE TO authenticated
  USING (public.is_admin_of(auth.uid(), workspace_id))
  WITH CHECK (public.is_admin_of(auth.uid(), workspace_id));

CREATE POLICY pi_delete_admins ON public.parking_items
  FOR DELETE TO authenticated
  USING (public.is_admin_of(auth.uid(), workspace_id));
