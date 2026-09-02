-- ================================================================
-- BuzzUp — Emoji pessoal no ranking da gamificação
-- Cole isso no SQL Editor do Supabase e clique Run ▶
-- ================================================================
-- Cada pessoa escolhe um emoji que aparece ao lado do nome dela no ranking,
-- para todo mundo do workspace.

ALTER TABLE public.people ADD COLUMN IF NOT EXISTS emoji text;

-- A policy de escrita em people é só de diretores (people_w). Sem esta função,
-- um assessor não conseguiria mexer no próprio emoji. Ela roda como dono da
-- tabela, mas só altera a linha de quem chamou, e só a coluna do emoji.
DROP FUNCTION IF EXISTS public.set_my_emoji(uuid, text);

CREATE FUNCTION public.set_my_emoji(_ws_id uuid, _emoji text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _valor text;
BEGIN
  IF NOT public.is_member_of(auth.uid(), _ws_id) THEN
    RAISE EXCEPTION 'not_a_member';
  END IF;

  _valor := nullif(btrim(coalesce(_emoji, '')), '');

  -- O emoji é exibido para o workspace inteiro: limita o tamanho para ninguém
  -- colar um texto no lugar. 8 caracteres cobrem emojis compostos (👨‍💻, 🇧🇷).
  IF _valor IS NOT NULL AND length(_valor) > 8 THEN
    RAISE EXCEPTION 'emoji_muito_longo';
  END IF;

  UPDATE public.people
     SET emoji = _valor
   WHERE user_id = auth.uid()
     AND workspace_id = _ws_id;

  RETURN _valor;
END $$;

GRANT EXECUTE ON FUNCTION public.set_my_emoji(uuid, text) TO authenticated;

-- ---------------------------------------------------------------
-- Conferência: deve aparecer uma linha
-- ---------------------------------------------------------------
SELECT column_name AS coluna_criada
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'people' AND column_name = 'emoji';
