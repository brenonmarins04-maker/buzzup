-- Remover uma pessoa do workspace por completo.
-- Apaga tudo que é dela dentro DESTE workspace e revoga o acesso; ela só volta
-- se pedir entrada com o código de novo.
-- Rode este arquivo INTEIRO no SQL Editor do Supabase, uma vez.

-- Remove a versão anterior: CREATE OR REPLACE não troca o tipo de retorno
DROP FUNCTION IF EXISTS public.remove_workspace_member(uuid, uuid);

CREATE FUNCTION public.remove_workspace_member(_ws_id uuid, _person_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _target_user uuid;
  _target_name text;
  _target_role text;
  _caller_is_owner boolean;
  _demandas int := 0;
  _pontos int := 0;
  _presencas int := 0;
BEGIN
  IF _caller IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.is_admin_of(_caller, _ws_id) THEN RAISE EXCEPTION 'not_allowed'; END IF;

  SELECT user_id, name INTO _target_user, _target_name
    FROM public.people WHERE id = _person_id AND workspace_id = _ws_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'person_not_found'; END IF;

  _caller_is_owner := public.is_owner_of(_caller, _ws_id);

  IF _target_user IS NOT NULL THEN
    -- Ninguém remove a si mesmo por aqui
    IF _target_user = _caller THEN RAISE EXCEPTION 'cannot_remove_self'; END IF;

    SELECT role INTO _target_role
      FROM public.workspace_members WHERE workspace_id = _ws_id AND user_id = _target_user;

    -- O dono do workspace nunca é removido
    IF _target_role = 'owner' THEN RAISE EXCEPTION 'cannot_remove_owner'; END IF;
    -- Diretor só é removido pelo owner (mesma regra de rebaixar cargo)
    IF _target_role = 'admin' AND NOT _caller_is_owner THEN RAISE EXCEPTION 'owner_only'; END IF;
  END IF;

  -- Demandas da pessoa neste workspace
  DELETE FROM public.parking_items
   WHERE workspace_id = _ws_id AND person_id = _person_id;
  GET DIAGNOSTICS _demandas = ROW_COUNT;

  -- Pontos da gamificação
  DELETE FROM public.gamification_awards
   WHERE workspace_id = _ws_id AND person_id = _person_id;
  GET DIAGNOSTICS _pontos = ROW_COUNT;

  -- Presenças
  DELETE FROM public.attendance_records
   WHERE workspace_id = _ws_id AND person_id = _person_id;
  GET DIAGNOSTICS _presencas = ROW_COUNT;

  -- O registro da pessoa: o CASCADE leva times, tarefas, posts e projetos
  DELETE FROM public.people WHERE id = _person_id AND workspace_id = _ws_id;

  IF _target_user IS NOT NULL THEN
    -- Revoga o acesso ao workspace
    DELETE FROM public.workspace_members
     WHERE workspace_id = _ws_id AND user_id = _target_user;

    -- Formulários preenchidos e registros de entrada deste workspace
    DELETE FROM public.form_completions
     WHERE workspace_id = _ws_id AND user_id = _target_user;
    DELETE FROM public.user_daily_logins
     WHERE workspace_id = _ws_id AND user_id = _target_user;

    -- Limpa pedidos antigos para que ela possa pedir entrada de novo
    DELETE FROM public.workspace_join_requests
     WHERE workspace_id = _ws_id AND user_id = _target_user;
  END IF;

  RETURN jsonb_build_object(
    'name', _target_name,
    'had_account', _target_user IS NOT NULL,
    'demandas', _demandas,
    'pontos', _pontos,
    'presencas', _presencas
  );
END $$;

GRANT EXECUTE ON FUNCTION public.remove_workspace_member(uuid, uuid) TO authenticated;
