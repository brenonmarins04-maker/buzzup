-- ================================================================
-- BuzzUp — Fechar leitura anônima da tabela workspaces
-- Cole no SQL Editor do Supabase e clique Run ▶
-- ================================================================
-- Testei a API de produção sem nenhum login e a tabela `workspaces` devolveu
-- registros. Todas as outras estão fechadas corretamente — só esta vaza.
--
-- O código do repositório nunca deu esse acesso (as policies são TO
-- authenticated). Então a permissão foi concedida direto no banco em algum
-- momento. Os blocos abaixo mostram o que existe hoje e removem o excesso.
--
-- Entrar por código continua funcionando: o app usa a função
-- request_join_workspace, que não depende de ler a tabela.

-- ---------------------------------------------------------------
-- 1) O que existe hoje (só leitura, não muda nada)
-- ---------------------------------------------------------------
SELECT
  policyname AS policy,
  roles,
  cmd AS operacao,
  qual AS condicao
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'workspaces'
ORDER BY policyname;

SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'workspaces'
ORDER BY grantee, privilege_type;

-- ---------------------------------------------------------------
-- 2) O conserto
-- ---------------------------------------------------------------
-- Tira qualquer permissão do visitante não autenticado
REVOKE ALL ON public.workspaces FROM anon;
REVOKE ALL ON public.workspaces FROM public;

-- Derruba policies antigas que valiam para todo mundo. Uma policy sem
-- restrição de papel ("public") alcança o anônimo, e foi por aí que vazou.
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname, roles
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'workspaces'
  LOOP
    IF 'anon' = ANY(pol.roles) OR 'public' = ANY(pol.roles) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.workspaces', pol.policyname);
      RAISE NOTICE 'Policy aberta removida: %', pol.policyname;
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;

-- Quem é membro lê; quem é dono administra
DROP POLICY IF EXISTS "ws_select_members" ON public.workspaces;
CREATE POLICY "ws_select_members" ON public.workspaces FOR SELECT TO authenticated
  USING (public.is_member_of(auth.uid(), id));

DROP POLICY IF EXISTS "ws_owner_all" ON public.workspaces;
CREATE POLICY "ws_owner_all" ON public.workspaces FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- Criar workspace continua livre para quem está logado
DROP POLICY IF EXISTS "ws_insert_own" ON public.workspaces;
CREATE POLICY "ws_insert_own" ON public.workspaces FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

-- ---------------------------------------------------------------
-- 3) Conferência — deve sobrar só policy com {authenticated}
-- ---------------------------------------------------------------
SELECT policyname AS policy, roles, cmd AS operacao
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'workspaces'
ORDER BY policyname;
