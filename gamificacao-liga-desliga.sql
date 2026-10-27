-- ================================================================
-- BuzzUp — Ligar e desligar a gamificação do workspace
-- Cole no SQL Editor do Supabase e clique Run ▶
-- ================================================================
-- Nem toda empresa usa ranking e pontos. O dono do workspace passa a ter um
-- botão que esconde a gamificação do site inteiro.
--
-- Desligar NÃO APAGA NADA: pontos, ações rápidas e histórico continuam aqui,
-- intactos. Só somem da tela. Religar devolve tudo como estava.
--
-- Só o DONO do workspace pode mexer. Diretor não pode — é decisão de empresa.

-- ---------------------------------------------------------------
-- 1) A coluna. Todo workspace que já existe nasce com a gamificação
--    LIGADA, que é como ele funciona hoje.
-- ---------------------------------------------------------------
ALTER TABLE public.workspace_config
  ADD COLUMN IF NOT EXISTS gamification_enabled boolean NOT NULL DEFAULT true;

-- ---------------------------------------------------------------
-- 2) Quem é dono. (Já deve existir; recriado aqui para este arquivo
--    rodar sozinho — o SQL Editor desfaz o arquivo inteiro se um
--    comando falhar.)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_owner_of(_user_id uuid, _ws_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = _user_id AND workspace_id = _ws_id AND role = 'owner'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_owner_of(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------
-- 3) O botão. A escrita direta em workspace_config segue restrita;
--    esta função altera SOMENTE a coluna gamification_enabled.
-- ---------------------------------------------------------------
DROP FUNCTION IF EXISTS public.set_gamification_enabled(uuid, boolean);

CREATE FUNCTION public.set_gamification_enabled(_ws_id uuid, _enabled boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _saved boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.is_owner_of(auth.uid(), _ws_id) THEN RAISE EXCEPTION 'not_owner'; END IF;
  IF _enabled IS NULL THEN RAISE EXCEPTION 'invalid_payload'; END IF;

  INSERT INTO public.workspace_config (workspace_id, gamification_enabled, updated_at)
  VALUES (_ws_id, _enabled, now())
  ON CONFLICT (workspace_id)
  DO UPDATE SET gamification_enabled = _enabled, updated_at = now()
  RETURNING gamification_enabled INTO _saved;

  RETURN _saved;
END $$;

GRANT EXECUTE ON FUNCTION public.set_gamification_enabled(uuid, boolean) TO authenticated;

-- ---------------------------------------------------------------
-- 4) Conferência — deve listar a coluna e a função
-- ---------------------------------------------------------------
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'workspace_config'
  AND column_name = 'gamification_enabled';

SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'set_gamification_enabled';
