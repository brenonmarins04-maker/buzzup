-- ================================================================
-- BuzzUp — Remover o portal do moderador do banco
-- Cole no SQL Editor do Supabase e clique Run ▶
-- ================================================================
-- O portal saiu do app: a rota, a página e o rastreio já não existem no
-- código. Falta tirar do banco o que existia só para ele.
--
-- A tabela platform_funnel_events era o "dado duplicado para visualização":
-- cada visita à página inicial, cada clique em criar conta e cada entrada em
-- workspace gravavam uma linha ali, só para alimentar o funil do portal.
--
-- O QUE FICA (é do app, não do portal):
--   user_daily_logins        — as "entradas no BuzzUp" dos relatórios
--   user_workspace_last_seen — o "visto por último" dos relatórios
--   workspace_summaries      — os resumos do workspace

-- ---------------------------------------------------------------
-- 1) Quanto há para remover (só leitura, rode antes se quiser ver)
-- ---------------------------------------------------------------
SELECT 'platform_funnel_events' AS tabela, count(*) AS linhas
FROM public.platform_funnel_events
UNION ALL
SELECT 'platform_admins', count(*) FROM public.platform_admins
UNION ALL
SELECT 'platform_admin_config', count(*) FROM public.platform_admin_config;

-- ---------------------------------------------------------------
-- 2) Remoção
-- ---------------------------------------------------------------
-- Funções que só o portal chamava
DROP FUNCTION IF EXISTS public.admin_list_workspaces(integer);
DROP FUNCTION IF EXISTS public.admin_list_workspaces();
DROP FUNCTION IF EXISTS public.admin_list_users(integer);
DROP FUNCTION IF EXISTS public.admin_list_users();
DROP FUNCTION IF EXISTS public.admin_list_demands(integer);
DROP FUNCTION IF EXISTS public.admin_list_demands();
DROP FUNCTION IF EXISTS public.admin_list_global_logins(integer);
DROP FUNCTION IF EXISTS public.admin_list_global_logins();
DROP FUNCTION IF EXISTS public.admin_platform_stats();
DROP FUNCTION IF EXISTS public.admin_platform_funnel();
DROP FUNCTION IF EXISTS public.admin_platform_funnel_events(integer);
DROP FUNCTION IF EXISTS public.admin_platform_funnel_events();
DROP FUNCTION IF EXISTS public.is_platform_admin(uuid);
DROP FUNCTION IF EXISTS public.is_platform_admin();

-- O rastreio que alimentava o funil
DROP FUNCTION IF EXISTS public.track_platform_event(text, text, text, jsonb);

-- As tabelas do portal. A do funil costuma ser a maior: uma linha por
-- visita, por clique e por entrada, desde sempre.
DROP TABLE IF EXISTS public.platform_funnel_events;
DROP TABLE IF EXISTS public.platform_admin_config;
DROP TABLE IF EXISTS public.platform_admins;

-- ---------------------------------------------------------------
-- 3) Conferência — as três consultas devem devolver zero linhas
-- ---------------------------------------------------------------
SELECT table_name AS tabela_que_deveria_ter_sumido
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('platform_funnel_events', 'platform_admins', 'platform_admin_config');

SELECT routine_name AS funcao_que_deveria_ter_sumido
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (routine_name LIKE 'admin\_%' OR routine_name IN ('is_platform_admin', 'track_platform_event'));

-- E estas três, que são do app, devem continuar aparecendo
SELECT table_name AS continua_no_lugar
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('user_daily_logins', 'user_workspace_last_seen', 'workspace_summaries')
ORDER BY table_name;
