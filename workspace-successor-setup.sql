-- ============================================================
-- Sucessão de owner: um workspace nunca fica sem dono
-- ============================================================
-- workspaces.owner_user_id não tem FK para auth.users, então apagar a conta do
-- dono deixava o workspace apontando para um usuário inexistente — ninguém
-- conseguia mais administrá-lo. Aqui a posse passa automaticamente para:
--   1) um diretor (admin);
--   2) se não houver, um líder (assessor com áreas de liderança);
--   3) se não houver, um assessor qualquer (aleatório).
-- Sem ninguém restante, o workspace é removido: sem membros, ele fica
-- inacessível para todo mundo.
--
-- Rode este arquivo INTEIRO no SQL Editor do Supabase, uma vez.

-- Escolhe o sucessor de um workspace, ignorando o usuário que está saindo.
DROP FUNCTION IF EXISTS public.pick_workspace_successor(uuid, uuid);

CREATE FUNCTION public.pick_workspace_successor(_ws_id uuid, _leaving uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.user_id
  FROM public.workspace_members m
  LEFT JOIN public.people p
    ON p.workspace_id = m.workspace_id AND p.user_id = m.user_id
  WHERE m.workspace_id = _ws_id
    AND m.user_id IS DISTINCT FROM _leaving
  ORDER BY
    -- 1) diretor, 2) líder, 3) assessor
    CASE
      WHEN m.role = 'admin' THEN 0
      WHEN p.leader_areas IS NOT NULL AND btrim(p.leader_areas) <> '' THEN 1
      ELSE 2
    END,
    random()
  LIMIT 1;
$$;

-- Passa a posse de um workspace para o sucessor. Devolve quem assumiu
-- (NULL quando não havia ninguém e o workspace foi removido).
DROP FUNCTION IF EXISTS public.transfer_workspace_ownership(uuid, uuid);

CREATE FUNCTION public.transfer_workspace_ownership(_ws_id uuid, _leaving uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _heir uuid;
BEGIN
  _heir := public.pick_workspace_successor(_ws_id, _leaving);

  IF _heir IS NULL THEN
    -- Ninguém sobrou: o workspace ficaria inacessível para sempre
    DELETE FROM public.workspaces WHERE id = _ws_id;
    RETURN NULL;
  END IF;

  UPDATE public.workspaces SET owner_user_id = _heir WHERE id = _ws_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (_ws_id, _heir, 'owner')
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'owner';

  RETURN _heir;
END $$;

-- Quando a conta é apagada (painel, SQL ou API), repassa os workspaces dela.
CREATE OR REPLACE FUNCTION public.handle_owner_account_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ws uuid;
BEGIN
  FOR _ws IN SELECT id FROM public.workspaces WHERE owner_user_id = OLD.id LOOP
    PERFORM public.transfer_workspace_ownership(_ws, OLD.id);
  END LOOP;

  -- Tira o acesso da conta que está saindo
  DELETE FROM public.workspace_members WHERE user_id = OLD.id;
  -- Desvincula a pessoa, preservando demandas, pontos e presenças
  UPDATE public.people SET user_id = NULL WHERE user_id = OLD.id;

  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
  BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_owner_account_deleted();

-- Sem GRANT para authenticated de propósito: estas funções são chamadas só
-- pelo gatilho (que roda como SECURITY DEFINER). Expostas ao cliente, qualquer
-- pessoa logada poderia forçar a troca de dono de um workspace alheio.
REVOKE ALL ON FUNCTION public.transfer_workspace_ownership(uuid, uuid) FROM public, authenticated, anon;
REVOKE ALL ON FUNCTION public.pick_workspace_successor(uuid, uuid) FROM public, authenticated, anon;

-- ------------------------------------------------------------
-- Conserta workspaces que já ficaram sem dono válido
-- ------------------------------------------------------------
DO $$
DECLARE
  _ws record;
  _heir uuid;
BEGIN
  FOR _ws IN
    SELECT w.id, w.name
    FROM public.workspaces w
    LEFT JOIN auth.users u ON u.id = w.owner_user_id
    WHERE u.id IS NULL
  LOOP
    _heir := public.transfer_workspace_ownership(_ws.id, NULL);
    IF _heir IS NULL THEN
      RAISE NOTICE 'Workspace "%" não tinha ninguém e foi removido.', _ws.name;
    ELSE
      RAISE NOTICE 'Workspace "%" agora é de %.', _ws.name, _heir;
    END IF;
  END LOOP;
END $$;
