-- Pontuação configurável: formulários valem pontos e o workspace define os
-- valores rápidos das demandas (hoje fixos em 1, 2 e 3).
-- Rode este arquivo INTEIRO no SQL Editor do Supabase, uma vez.

-- 1) Quantos pontos cada formulário vale ao ser marcado como preenchido
ALTER TABLE public.workspace_forms
  ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 1;

-- 2) Valores rápidos de pontuação das demandas, por workspace
ALTER TABLE public.workspace_config
  ADD COLUMN IF NOT EXISTS demand_points jsonb NOT NULL DEFAULT '[1, 2, 3]'::jsonb;

-- 3) Diretores (e owner) podem mudar os valores das demandas.
--    A escrita direta em workspace_config continua restrita ao owner (para os
--    nomes das áreas); esta função altera SOMENTE a coluna demand_points.
DROP FUNCTION IF EXISTS public.set_demand_points(uuid, integer[]);

CREATE FUNCTION public.set_demand_points(_ws_id uuid, _points integer[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _clean integer[];
  _saved jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.is_admin_of(auth.uid(), _ws_id) THEN RAISE EXCEPTION 'not_allowed'; END IF;

  -- Mantém de 1 a 6 valores, cada um entre 1 e 99, sem repetidos e ordenados
  SELECT array_agg(v ORDER BY v) INTO _clean
  FROM (
    SELECT DISTINCT least(greatest(x, 1), 99) AS v
    FROM unnest(_points) AS x
  ) s;

  IF _clean IS NULL OR array_length(_clean, 1) = 0 THEN
    RAISE EXCEPTION 'invalid_points';
  END IF;
  IF array_length(_clean, 1) > 6 THEN
    _clean := _clean[1:6];
  END IF;

  INSERT INTO public.workspace_config (workspace_id, demand_points, updated_at)
  VALUES (_ws_id, to_jsonb(_clean), now())
  ON CONFLICT (workspace_id)
  DO UPDATE SET demand_points = to_jsonb(_clean), updated_at = now()
  RETURNING demand_points INTO _saved;

  RETURN _saved;
END $$;

GRANT EXECUTE ON FUNCTION public.set_demand_points(uuid, integer[]) TO authenticated;

-- 4) O fallback que concede o ponto do formulário (usado quando a RLS bloqueia
--    a escrita direta do assessor) passa a usar os pontos configurados no
--    formulário em vez de 1 fixo.
DROP FUNCTION IF EXISTS public.award_form_completion_point(uuid);

CREATE FUNCTION public.award_form_completion_point(_form_id uuid)
RETURNS public.gamification_awards
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _ws uuid;
  _title text;
  _pts integer;
  _person uuid;
  _new public.gamification_awards;
BEGIN
  IF _uid IS NULL THEN RETURN NULL; END IF;

  SELECT workspace_id, title, coalesce(points, 1)
    INTO _ws, _title, _pts
    FROM public.workspace_forms WHERE id = _form_id;
  IF _ws IS NULL THEN RETURN NULL; END IF;
  IF NOT public.is_member_of(_uid, _ws) THEN RETURN NULL; END IF;

  -- precisa ter realmente marcado o formulário como preenchido
  IF NOT EXISTS (
    SELECT 1 FROM public.form_completions WHERE form_id = _form_id AND user_id = _uid
  ) THEN RETURN NULL; END IF;

  SELECT id INTO _person FROM public.people
   WHERE workspace_id = _ws AND user_id = _uid LIMIT 1;
  IF _person IS NULL THEN RETURN NULL; END IF;

  -- não duplica: 1 award por formulário
  IF EXISTS (
    SELECT 1 FROM public.gamification_awards
     WHERE workspace_id = _ws AND person_id = _person AND action_id = _form_id
  ) THEN RETURN NULL; END IF;

  INSERT INTO public.gamification_awards (workspace_id, person_id, action_id, action_name, points, awarded_by)
  VALUES (_ws, _person, _form_id, 'Formulário: ' || coalesce(_title, 'Formulário'),
          least(greatest(_pts, 1), 99), _uid)
  RETURNING * INTO _new;
  RETURN _new;
END $$;

GRANT EXECUTE ON FUNCTION public.award_form_completion_point(uuid) TO authenticated;
