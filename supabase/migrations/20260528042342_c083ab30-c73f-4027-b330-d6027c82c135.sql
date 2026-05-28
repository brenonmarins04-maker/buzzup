-- Remove possíveis duplicatas antes de criar constraints únicas
DELETE FROM public.attendance_records a USING public.attendance_records b
WHERE a.id < b.id AND a.workspace_id = b.workspace_id AND a.area = b.area AND a.person_id = b.person_id AND a.date = b.date;

DELETE FROM public.attendance_settings a USING public.attendance_settings b
WHERE a.id < b.id AND a.workspace_id = b.workspace_id AND a.area = b.area;

ALTER TABLE public.attendance_records
  ADD CONSTRAINT attendance_records_unique UNIQUE (workspace_id, area, person_id, date);

ALTER TABLE public.attendance_settings
  ADD CONSTRAINT attendance_settings_unique UNIQUE (workspace_id, area);