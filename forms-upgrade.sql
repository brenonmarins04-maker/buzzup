-- Formulários: público com vários times/áreas e resposta "não vou preencher".
-- Rode este arquivo INTEIRO no SQL Editor do Supabase, uma vez.

-- 1) Vários destinos por formulário (times ou áreas).
--    target_value (único) continua existindo para os formulários antigos.
ALTER TABLE public.workspace_forms
  ADD COLUMN IF NOT EXISTS target_values jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Migra o destino único existente para a lista
UPDATE public.workspace_forms
   SET target_values = to_jsonb(ARRAY[target_value])
 WHERE target_value IS NOT NULL
   AND (target_values IS NULL OR target_values = '[]'::jsonb);

-- 2) Resposta da pessoa: 'done' = preencheu, 'declined' = não vai preencher
ALTER TABLE public.form_completions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'done';

ALTER TABLE public.form_completions
  DROP CONSTRAINT IF EXISTS form_completions_status_check;
ALTER TABLE public.form_completions
  ADD CONSTRAINT form_completions_status_check
  CHECK (status IN ('done', 'declined'));

-- 3) Ponto só é concedido a quem realmente preencheu (status = 'done')
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

  -- precisa ter marcado como PREENCHIDO (recusa não pontua)
  IF NOT EXISTS (
    SELECT 1 FROM public.form_completions
     WHERE form_id = _form_id AND user_id = _uid AND status = 'done'
  ) THEN RETURN NULL; END IF;

  SELECT id INTO _person FROM public.people
   WHERE workspace_id = _ws AND user_id = _uid LIMIT 1;
  IF _person IS NULL THEN RETURN NULL; END IF;

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
