-- Ciclos de gamificação: o diretor cria períodos nomeados (Ciclo 1, Ciclo 2…)
-- e escolhe qual está ativo. O ranking do workspace inteiro passa a contar
-- só os pontos daquele ciclo.
-- Rode este arquivo INTEIRO no SQL Editor do Supabase, uma vez.

-- Guarda { "cycles": [{id, name, start, end}], "activeId": "..." | null }
ALTER TABLE public.workspace_config
  ADD COLUMN IF NOT EXISTS gamification_cycles jsonb NOT NULL DEFAULT '{"cycles": [], "activeId": null}'::jsonb;

-- Diretores (e owner) podem criar/apagar ciclos e trocar o ativo.
-- A escrita direta em workspace_config segue restrita ao owner (nomes das
-- áreas); esta função altera SOMENTE a coluna gamification_cycles.
DROP FUNCTION IF EXISTS public.set_gamification_cycles(uuid, jsonb);

CREATE FUNCTION public.set_gamification_cycles(_ws_id uuid, _payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _saved jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.is_admin_of(auth.uid(), _ws_id) THEN RAISE EXCEPTION 'not_allowed'; END IF;

  IF _payload IS NULL OR jsonb_typeof(_payload -> 'cycles') <> 'array' THEN
    RAISE EXCEPTION 'invalid_payload';
  END IF;
  -- Limite de segurança: no máximo 50 ciclos
  IF jsonb_array_length(_payload -> 'cycles') > 50 THEN
    RAISE EXCEPTION 'too_many_cycles';
  END IF;

  INSERT INTO public.workspace_config (workspace_id, gamification_cycles, updated_at)
  VALUES (_ws_id, _payload, now())
  ON CONFLICT (workspace_id)
  DO UPDATE SET gamification_cycles = _payload, updated_at = now()
  RETURNING gamification_cycles INTO _saved;

  RETURN _saved;
END $$;

GRANT EXECUTE ON FUNCTION public.set_gamification_cycles(uuid, jsonb) TO authenticated;
