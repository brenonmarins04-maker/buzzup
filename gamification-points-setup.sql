-- Pontos de gamificação em tempo real para TODOS os cargos.
-- A RLS de gamification_awards ("gw_w") só deixa diretores/owner escrever.
-- Ou seja: quando um ASSESSOR marca "Já preenchi" num formulário ou conclui a
-- própria demanda, o insert do ponto é bloqueado e ele fica sem o +1.
-- Estas funções SECURITY DEFINER validam e concedem o ponto com segurança.
-- Rode uma vez no SQL Editor do Supabase.

-- 1) +1 ponto ao marcar formulário como preenchido (idempotente por formulário)
create or replace function public.award_form_completion_point(_form_id uuid)
returns public.gamification_awards
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _ws uuid;
  _title text;
  _person uuid;
  _new public.gamification_awards;
begin
  if _uid is null then return null; end if;

  select workspace_id, title into _ws, _title from public.workspace_forms where id = _form_id;
  if _ws is null then return null; end if;
  if not public.is_member_of(_uid, _ws) then return null; end if;

  -- precisa ter realmente marcado o formulário como preenchido
  if not exists (select 1 from public.form_completions where form_id = _form_id and user_id = _uid) then
    return null;
  end if;

  select id into _person from public.people where workspace_id = _ws and user_id = _uid limit 1;
  if _person is null then return null; end if;

  -- 1 ponto por formulário, no máximo
  if exists (
    select 1 from public.gamification_awards
    where workspace_id = _ws and person_id = _person and action_id = _form_id
  ) then return null; end if;

  insert into public.gamification_awards (workspace_id, person_id, action_id, action_name, points, awarded_by)
  values (_ws, _person, _form_id, 'Formulário: ' || coalesce(_title, 'Formulário'), 1, _uid)
  returning * into _new;
  return _new;
end;
$$;

-- 2) Remove o ponto do formulário ao desfazer o preenchimento
create or replace function public.revoke_form_completion_point(_form_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _ws uuid;
  _person uuid;
begin
  if _uid is null then return; end if;
  select workspace_id into _ws from public.workspace_forms where id = _form_id;
  if _ws is null then return; end if;
  select id into _person from public.people where workspace_id = _ws and user_id = _uid limit 1;
  if _person is null then return; end if;
  delete from public.gamification_awards
    where workspace_id = _ws and person_id = _person and action_id = _form_id;
end;
$$;

-- 3) Pontos ao concluir a PRÓPRIA demanda (assessor). Valida que a demanda está
--    concluída e pertence a uma pessoa vinculada ao usuário. Idempotente por demanda.
create or replace function public.award_demand_completion_point(_item_id uuid)
returns public.gamification_awards
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _ws uuid;
  _person uuid;
  _pts int;
  _title text;
  _status text;
  _new public.gamification_awards;
begin
  if _uid is null then return null; end if;

  select workspace_id, person_id, points, title, status
    into _ws, _person, _pts, _title, _status
    from public.parking_items where id = _item_id;
  if _ws is null or _person is null then return null; end if;
  if _status <> 'done' then return null; end if;
  if not public.is_member_of(_uid, _ws) then return null; end if;

  -- só concede se a demanda é da própria pessoa (diretores usam o caminho direto)
  if not exists (
    select 1 from public.people where id = _person and workspace_id = _ws and user_id = _uid
  ) then return null; end if;

  -- 1 award por demanda, no máximo (evita farm marcando/desmarcando)
  if exists (
    select 1 from public.gamification_awards
    where workspace_id = _ws and person_id = _person and action_id = _item_id
  ) then return null; end if;

  insert into public.gamification_awards (workspace_id, person_id, action_id, action_name, points, awarded_by)
  values (_ws, _person, _item_id, 'Demanda: ' || coalesce(_title, 'Demanda'), greatest(1, least(3, coalesce(_pts, 1))), _uid)
  returning * into _new;
  return _new;
end;
$$;

grant execute on function public.award_form_completion_point(uuid) to authenticated;
grant execute on function public.revoke_form_completion_point(uuid) to authenticated;
grant execute on function public.award_demand_completion_point(uuid) to authenticated;

-- Tempo real: garante que awards está na publicação do Realtime
do $$ begin
  alter publication supabase_realtime add table public.gamification_awards;
exception when duplicate_object then null; end $$;
