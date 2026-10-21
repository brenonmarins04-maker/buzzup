-- ================================================================
-- BuzzUp — Remover os "eventos" do calendário
-- Cole no SQL Editor do Supabase e clique Run ▶
-- ================================================================
-- O calendário passou a ter um tipo de item só: a demanda. O "evento" era
-- uma segunda coisa agendável, com tipos próprios (Reunião, Palestra...), que
-- ninguém mais cria — a tela, o modal e o código já saíram do app.
--
-- Restam duas tabelas usadas só por ele:
--   calendar_items  — os eventos em si
--   event_types     — os tipos coloridos que apareciam no seletor
--
-- O QUE NÃO É TOCADO (é o calendário de verdade):
--   parking_items   — as demandas, com área/time, responsável, data e pontos
--   tasks, posts    — demandas antigas e publicações

-- ---------------------------------------------------------------
-- 1) O que existe hoje (só leitura — rode antes se quiser ver)
-- ---------------------------------------------------------------
SELECT 'calendar_items' AS tabela, count(*) AS linhas FROM public.calendar_items
UNION ALL
SELECT 'event_types', count(*) FROM public.event_types;

-- ---------------------------------------------------------------
-- 2) Remoção
-- ---------------------------------------------------------------
-- calendar_items sai primeiro: era quem apontava para os tipos.
DROP TABLE IF EXISTS public.calendar_items CASCADE;
DROP TABLE IF EXISTS public.event_types CASCADE;

-- ---------------------------------------------------------------
-- 3) Conferência
-- ---------------------------------------------------------------
-- Esta deve voltar VAZIA (as duas sumiram):
SELECT table_name AS deveria_ter_sumido
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('calendar_items', 'event_types');

-- E esta deve listar as três, intactas:
SELECT table_name AS continua_no_lugar
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('parking_items', 'tasks', 'posts')
ORDER BY table_name;
