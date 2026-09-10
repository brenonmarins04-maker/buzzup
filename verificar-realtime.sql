-- ================================================================
-- BuzzUp — Conferir se o realtime está completo
-- Cole no SQL Editor do Supabase e clique Run ▶
-- ================================================================
-- Assinar uma tabela SEMPRE dá certo do lado do app, mesmo que ela não esteja
-- publicada — a diferença é que nenhum evento chega. Só dá para saber olhando
-- o banco, que é o que esta consulta faz.
--
-- O resultado ideal: nenhuma linha com "FALTA PUBLICAR".

WITH assinadas(tabela) AS (
  VALUES
    ('people'), ('tasks'), ('task_assignees'), ('posts'), ('post_assignees'),
    ('projects'), ('project_participants'), ('teams'), ('team_members'),
    ('calendar_items'), ('categories'), ('channels'), ('event_types'),
    ('area_notes'), ('parking_items'), ('gamification_actions'),
    ('gamification_awards'), ('lead_thermometer'), ('attendance_settings'),
    ('attendance_records'), ('broadcasts'), ('workspace_forms'),
    ('form_completions'), ('demand_requests')
)
SELECT
  a.tabela,
  CASE WHEN p.tablename IS NULL THEN 'FALTA PUBLICAR' ELSE 'ok' END AS realtime,
  CASE c.relreplident
    WHEN 'f' THEN 'ok'
    ELSE 'sem REPLICA IDENTITY FULL (update/delete não chegam)'
  END AS replica
FROM assinadas a
LEFT JOIN pg_publication_tables p
       ON p.pubname = 'supabase_realtime'
      AND p.schemaname = 'public'
      AND p.tablename = a.tabela
LEFT JOIN pg_class c ON c.relname = a.tabela
LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
ORDER BY (p.tablename IS NULL) DESC, a.tabela;


-- ---------------------------------------------------------------
-- Conserto: publica e ajusta tudo o que estiver faltando
-- ---------------------------------------------------------------
-- Rode este bloco se a consulta acima acusar alguma coisa.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'people','tasks','task_assignees','posts','post_assignees',
    'projects','project_participants','teams','team_members',
    'calendar_items','categories','channels','event_types',
    'area_notes','parking_items','gamification_actions',
    'gamification_awards','lead_thermometer','attendance_settings',
    'attendance_records','broadcasts','workspace_forms',
    'form_completions','demand_requests'
  ]
  LOOP
    -- Pula tabela que ainda não existe neste banco
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    );

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      RAISE NOTICE 'Publicada: %', t;
    END IF;

    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
  END LOOP;
END $$;
