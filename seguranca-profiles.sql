-- ================================================================
-- BuzzUp — URGENTE: fechar leitura anônima da tabela profiles
-- Cole no SQL Editor do Supabase e clique Run ▶
-- ================================================================
-- O QUE ESTÁ ACONTECENDO AGORA
--
-- Testei a API de produção SEM NENHUM LOGIN, usando só a chave pública que
-- vai dentro do JavaScript do site (qualquer pessoa tira ela do navegador em
-- dez segundos). A tabela `profiles` devolveu as 68 contas, com NOME e
-- E-MAIL de todo mundo:
--
--   Content-Range: 0-67/68
--   colunas visíveis: user_id, display_name, email, created_at, updated_at
--
-- Ou seja: a lista de e-mails dos seus usuários está aberta na internet.
-- É o mesmo tipo de brecha que a tabela `workspaces` tinha e que já foi
-- fechada pelo seguranca-workspaces.sql.
--
-- O QUE O APP PRECISA (conferido no código)
--
-- O BuzzUp só toca em `profiles` em dois lugares, os dois sobre a PRÓPRIA
-- linha de quem está logado: ler o nome de exibição e gravá-lo. Os nomes das
-- pessoas dentro de um workspace vêm da tabela `people`, não daqui.
-- Por isso dá para fechar tudo: cada um enxerga só o próprio perfil.

-- ---------------------------------------------------------------
-- 1) O que existe hoje (só leitura, não muda nada)
-- ---------------------------------------------------------------
SELECT policyname AS policy, roles, cmd AS operacao, qual AS condicao
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles'
ORDER BY policyname;

SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY grantee, privilege_type;

-- ---------------------------------------------------------------
-- 2) O conserto
-- ---------------------------------------------------------------
-- Tira qualquer permissão do visitante não autenticado
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.profiles FROM public;

-- Derruba policies que valem para todo mundo. Uma policy sem restrição de
-- papel ("public") alcança o anônimo — foi por aí que vazou.
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname, roles
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    IF 'anon' = ANY(pol.roles) OR 'public' = ANY(pol.roles) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
      RAISE NOTICE 'Policy aberta removida: %', pol.policyname;
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Cada pessoa vê e edita SOMENTE o próprio perfil.
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------
-- 3) Conferência — deve sobrar só policy com {authenticated}
-- ---------------------------------------------------------------
SELECT policyname AS policy, roles, cmd AS operacao
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles'
ORDER BY policyname;

-- Depois de rodar, me avisa que eu testo a API de fora de novo: o esperado
-- é a leitura anônima voltar vazia ou com erro de permissão.
