
CREATE TABLE public.lead_thermometer (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  name text NOT NULL,
  value text NOT NULL DEFAULT '',
  area_size text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_thermometer TO authenticated;
GRANT ALL ON public.lead_thermometer TO service_role;

ALTER TABLE public.lead_thermometer ENABLE ROW LEVEL SECURITY;

CREATE POLICY members_select_lead_thermometer ON public.lead_thermometer
  FOR SELECT TO authenticated
  USING (workspace_id = get_workspace_id(auth.uid()));

CREATE POLICY admins_write_lead_thermometer ON public.lead_thermometer
  FOR ALL TO authenticated
  USING (workspace_id = get_workspace_id(auth.uid()) AND is_workspace_admin(auth.uid()))
  WITH CHECK (workspace_id = get_workspace_id(auth.uid()) AND is_workspace_admin(auth.uid()));
