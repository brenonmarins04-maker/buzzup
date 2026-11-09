-- ================================================================
-- BuzzUp — Panorama: contas, workspaces e pessoas por workspace
-- Cole no SQL Editor do Supabase e clique Run ▶
-- ================================================================
-- Rode TUDO de uma vez. O Supabase mostra o resultado de cada consulta
-- numa aba. São cinco.
--
-- Por que você precisa rodar em vez de eu buscar: a API de produção, sem
-- login, não lê `workspaces` nem `workspace_members` (é o certo — foi o
-- seguranca-workspaces.sql que fechou). O portal de moderador, que tinha
-- funções de leitura global, foi removido a seu pedido. Então o único
-- caminho para esses números é aqui dentro.

-- ---------------------------------------------------------------
-- 1) Os totais, numa linha só
-- ---------------------------------------------------------------
SELECT
  (SELECT count(*) FROM auth.users)                     AS contas_de_login,
  (SELECT count(*) FROM public.profiles)                AS perfis,
  (SELECT count(*) FROM public.workspaces)              AS workspaces,
  (SELECT count(*) FROM public.workspace_members)       AS vinculos_pessoa_workspace,
  (SELECT count(*) FROM public.people)                  AS pessoas_cadastradas;

-- ---------------------------------------------------------------
-- 2) Cada workspace, com quanta gente tem
-- ---------------------------------------------------------------
-- `membros` = contas com acesso de verdade (quem entrou pelo código).
-- `pessoas` = registros na lista da entidade, que pode incluir quem ainda
--             não criou conta. Os dois números raramente batem, e os dois
--             interessam: um é acesso, o outro é tamanho da entidade.
SELECT
  w.name                                               AS workspace,
  w.code                                               AS codigo,
  (SELECT count(*) FROM public.workspace_members m
     WHERE m.workspace_id = w.id)                      AS membros,
  (SELECT count(*) FROM public.people p
     WHERE p.workspace_id = w.id)                      AS pessoas,
  (SELECT count(*) FROM public.parking_items d
     WHERE d.workspace_id = w.id)                      AS demandas,
  coalesce(dono.email, '—')                            AS dono,
  w.created_at::date                                   AS criado_em
FROM public.workspaces w
LEFT JOIN public.workspace_members om
       ON om.workspace_id = w.id AND om.role = 'owner'
LEFT JOIN auth.users dono ON dono.id = om.user_id
ORDER BY membros DESC, pessoas DESC, w.name;

-- ---------------------------------------------------------------
-- 3) Todas as contas
-- ---------------------------------------------------------------
SELECT
  u.email,
  coalesce(p.display_name, '—')                        AS nome,
  u.created_at::date                                   AS criou_conta,
  CASE WHEN u.email_confirmed_at IS NULL
       THEN 'não confirmou' ELSE 'confirmado' END      AS email,
  u.last_sign_in_at::date                              AS ultimo_acesso,
  (SELECT count(*) FROM public.workspace_members m
     WHERE m.user_id = u.id)                           AS workspaces
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
ORDER BY u.created_at;

-- ---------------------------------------------------------------
-- 4) Quantas contas entraram por mês
-- ---------------------------------------------------------------
SELECT
  to_char(date_trunc('month', created_at), 'YYYY-MM')  AS mes,
  count(*)                                             AS contas
FROM auth.users
GROUP BY 1
ORDER BY 1;

-- ---------------------------------------------------------------
-- 5) Contas que não estão em workspace nenhum
-- ---------------------------------------------------------------
-- Criou conta e parou aí. É o furo do funil.
SELECT u.email, u.created_at::date AS criou_conta
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.workspace_members m WHERE m.user_id = u.id
)
ORDER BY u.created_at;
