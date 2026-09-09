-- ================================================================
-- BuzzUp — Apelido escolhido pela própria pessoa, com aprovação
-- Cole isso no SQL Editor do Supabase e clique Run ▶
-- ================================================================
-- Cada pessoa escreve o apelido que quer. Ele fica pendente até um diretor
-- aprovar na aba Apelidos da gamificação. Só depois aparece no ranking.

ALTER TABLE public.people ADD COLUMN IF NOT EXISTS pending_nickname text;

-- A policy de escrita em people é só de diretor (people_w). Sem esta função,
-- um assessor não conseguiria propor o próprio apelido. Ela roda como dono da
-- tabela, mas altera só a linha de quem chamou e só a coluna do pendente —
-- o apelido valendo (nickname) continua sendo mexido apenas por diretores.
DROP FUNCTION IF EXISTS public.set_my_nickname(uuid, text);

CREATE FUNCTION public.set_my_nickname(_ws_id uuid, _nickname text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _valor text;
  _atual text;
BEGIN
  IF NOT public.is_member_of(auth.uid(), _ws_id) THEN
    RAISE EXCEPTION 'not_a_member';
  END IF;

  _valor := nullif(btrim(coalesce(_nickname, '')), '');

  IF _valor IS NOT NULL AND length(_valor) > 40 THEN
    RAISE EXCEPTION 'apelido_muito_longo';
  END IF;

  SELECT nickname INTO _atual
    FROM public.people
   WHERE user_id = auth.uid() AND workspace_id = _ws_id
   LIMIT 1;

  -- Pedir o apelido que já está valendo não gera pendência nova
  IF _valor IS NOT DISTINCT FROM _atual THEN
    UPDATE public.people SET pending_nickname = NULL
     WHERE user_id = auth.uid() AND workspace_id = _ws_id;
    RETURN NULL;
  END IF;

  UPDATE public.people
     SET pending_nickname = _valor
   WHERE user_id = auth.uid()
     AND workspace_id = _ws_id;

  RETURN _valor;
END $$;

GRANT EXECUTE ON FUNCTION public.set_my_nickname(uuid, text) TO authenticated;

-- ---------------------------------------------------------------
-- Conferência: deve aparecer uma linha
-- ---------------------------------------------------------------
SELECT column_name AS coluna_criada
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'people' AND column_name = 'pending_nickname';
