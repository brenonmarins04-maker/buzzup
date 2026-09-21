-- ================================================================
-- BuzzUp — Workspaces com 2 ou mais pessoas
-- Cole no SQL Editor do Supabase e clique Run ▶
-- ================================================================
-- Conta por membros de verdade (workspace_members), que é quem tem acesso.

SELECT
  w.name                    AS workspace,
  w.code                    AS codigo,
  count(m.user_id)          AS pessoas,
  w.created_at::date        AS criado_em
FROM public.workspaces w
JOIN public.workspace_members m ON m.workspace_id = w.id
GROUP BY w.id, w.name, w.code, w.created_at
HAVING count(m.user_id) >= 2
ORDER BY count(m.user_id) DESC, w.name;

-- Só o número total
SELECT count(*) AS workspaces_com_2_ou_mais
FROM (
  SELECT w.id
  FROM public.workspaces w
  JOIN public.workspace_members m ON m.workspace_id = w.id
  GROUP BY w.id
  HAVING count(m.user_id) >= 2
) x;
