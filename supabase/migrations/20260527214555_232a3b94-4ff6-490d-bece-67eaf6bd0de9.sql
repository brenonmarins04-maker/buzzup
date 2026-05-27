
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS area text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS area text;
ALTER TABLE public.calendar_items ADD COLUMN IF NOT EXISTS area text;

CREATE TABLE IF NOT EXISTS public.area_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  area text NOT NULL,
  name text NOT NULL,
  url text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.area_notes TO authenticated;
GRANT ALL ON public.area_notes TO service_role;
ALTER TABLE public.area_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY members_select_area_notes ON public.area_notes FOR SELECT TO authenticated
  USING (workspace_id = public.get_workspace_id(auth.uid()));
CREATE POLICY admins_write_area_notes ON public.area_notes FOR ALL TO authenticated
  USING (workspace_id = public.get_workspace_id(auth.uid()) AND public.is_workspace_admin(auth.uid()))
  WITH CHECK (workspace_id = public.get_workspace_id(auth.uid()) AND public.is_workspace_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.parking_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  area text NOT NULL,
  person_id uuid,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parking_items TO authenticated;
GRANT ALL ON public.parking_items TO service_role;
ALTER TABLE public.parking_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY members_select_parking_items ON public.parking_items FOR SELECT TO authenticated
  USING (workspace_id = public.get_workspace_id(auth.uid()));
CREATE POLICY admins_write_parking_items ON public.parking_items FOR ALL TO authenticated
  USING (workspace_id = public.get_workspace_id(auth.uid()) AND public.is_workspace_admin(auth.uid()))
  WITH CHECK (workspace_id = public.get_workspace_id(auth.uid()) AND public.is_workspace_admin(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.area_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.parking_items;
