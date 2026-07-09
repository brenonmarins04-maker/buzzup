-- +1 ponto na gamificação quando o usuário marca um formulário como preenchido.
-- A RLS de gamification_awards só deixa admin escrever (gw_w), então membros não
-- podem se auto-conceder ponto direto. Estas funções SECURITY DEFINER validam e
-- concedem/removem o ponto com segurança. Rode no SQL Editor do Supabase.

-- Concede 1 ponto pelo preenchimento do formulário (idempotente).
-- Retorna a linha do award criado, ou NULL se não concedeu (já tinha, sem
-- pessoa vinculada, não é membro, ou não marcou o formulário de fato).
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

  -- precisa ser membro do workspace
  if not public.is_member_of(_uid, _ws) then return null; end if;

  -- precisa ter realmente marcado o formulário como preenchido
  if not exists (select 1 from public.form_completions where form_id = _form_id and user_id = _uid) then
    return null;
  end if;

  -- pessoa vinculada ao usuário nesse workspace
  select id into _person from public.people where workspace_id = _ws and user_id = _uid limit 1;
  if _person is null then return null; end if;

  -- idempotente: se já ganhou o ponto por esse formulário, não concede de novo
  if exists (
    select 1 from public.gamification_awards
    where workspace_id = _ws and person_id = _person and action_id = _form_id
  ) then
    return null;
  end if;

  insert into public.gamification_awards (workspace_id, person_id, action_id, action_name, points, awarded_by)
  values (_ws, _person, _form_id, 'Formulário preenchido: ' || coalesce(_title, 'Formulário'), 1, _uid)
  returning * into _new;

  return _new;
end;
$$;

-- Remove o ponto concedido pelo preenchimento (ao desfazer/voltar para pendente).
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

grant execute on function public.award_form_completion_point(uuid) to authenticated;
grant execute on function public.revoke_form_completion_point(uuid) to authenticated;
