
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'gamification_awards','gamification_actions',
    'parking_items','tasks','task_assignees',
    'people','projects','posts','calendar_items',
    'categories','channels','teams','team_members',
    'post_assignees','project_participants','event_types',
    'area_notes','lead_thermometer',
    'attendance_settings','attendance_records'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
  END LOOP;
END $$;
