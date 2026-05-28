
CREATE TABLE public.attendance_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  area text NOT NULL,
  interval_days integer NOT NULL DEFAULT 7,
  start_date text NOT NULL DEFAULT '',
  meeting_count integer NOT NULL DEFAULT 8,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, area)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_settings TO authenticated;
GRANT ALL ON public.attendance_settings TO service_role;

ALTER TABLE public.attendance_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY members_select_attendance_settings ON public.attendance_settings
  FOR SELECT TO authenticated
  USING (workspace_id = get_workspace_id(auth.uid()));

CREATE POLICY admins_write_attendance_settings ON public.attendance_settings
  FOR ALL TO authenticated
  USING (workspace_id = get_workspace_id(auth.uid()) AND is_workspace_admin(auth.uid()))
  WITH CHECK (workspace_id = get_workspace_id(auth.uid()) AND is_workspace_admin(auth.uid()));

CREATE TABLE public.attendance_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  area text NOT NULL,
  person_id uuid NOT NULL,
  date text NOT NULL,
  status text NOT NULL DEFAULT 'P',
  justification text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, area, person_id, date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO authenticated;
GRANT ALL ON public.attendance_records TO service_role;

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY members_select_attendance_records ON public.attendance_records
  FOR SELECT TO authenticated
  USING (workspace_id = get_workspace_id(auth.uid()));

CREATE POLICY admins_write_attendance_records ON public.attendance_records
  FOR ALL TO authenticated
  USING (workspace_id = get_workspace_id(auth.uid()) AND is_workspace_admin(auth.uid()))
  WITH CHECK (workspace_id = get_workspace_id(auth.uid()) AND is_workspace_admin(auth.uid()));
