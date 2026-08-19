-- ============================================================
-- Apaga TODAS as contas, menos brenonmarins05@gmail.com
-- ============================================================
-- IMPORTANTE: workspaces.owner_user_id NÃO tem chave estrangeira para
-- auth.users. Ou seja, apagar o dono NÃO apaga o workspace — ele ficaria
-- apontando para um usuário inexistente e ninguém conseguiria administrá-lo.
-- Por isso este script TRANSFERE a posse dos workspaces para a conta mantida
-- antes de apagar as demais. Nenhum workspace é perdido.
--
-- Rode o PASSO 1 primeiro (só leitura) para ver o que será afetado.

-- ------------------------------------------------------------
-- PASSO 1 — Confira antes (não altera nada)
-- ------------------------------------------------------------
select
  u.email,
  u.created_at,
  count(w.id)                                as workspaces_que_e_dono,
  coalesce(string_agg(w.name, ', '), '—')    as nomes_dos_workspaces
from auth.users u
left join public.workspaces w on w.owner_user_id = u.id
where lower(u.email) <> lower('brenonmarins05@gmail.com')
group by u.email, u.created_at
order by workspaces_que_e_dono desc, u.email;


-- ------------------------------------------------------------
-- PASSO 2 — Apaga as contas (rode depois de conferir o passo 1)
-- ------------------------------------------------------------
do $$
declare
  _keep_email text := 'brenonmarins05@gmail.com';  -- <<< a conta que fica
  _keep   uuid;
  _victim uuid;
  _email  text;
  _col    record;
  _n      int := 0;
begin
  select id into _keep from auth.users where lower(email) = lower(_keep_email);
  if _keep is null then
    raise exception 'Conta a manter não encontrada: %', _keep_email;
  end if;

  -- 1) Posse dos workspaces vai para a conta mantida (senão ficariam sem dono)
  update public.workspaces set owner_user_id = _keep where owner_user_id <> _keep;

  -- garante que ela seja owner em todos eles
  insert into public.workspace_members (workspace_id, user_id, role)
    select w.id, _keep, 'owner' from public.workspaces w
  on conflict (workspace_id, user_id) do update set role = 'owner';

  -- 2) Remove cada conta
  for _victim, _email in
    select id, email from auth.users where id <> _keep
  loop
    -- Desvincula a pessoa: demandas, pontos e presenças ficam no histórico
    update public.people set user_id = null where user_id = _victim;

    -- Limpa toda coluna que aponta para um usuário. Se aceita nulo,
    -- desvincula (preserva o registro); se não aceita, remove a linha.
    for _col in
      select c.table_name, c.column_name, c.is_nullable
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name
       and t.table_type = 'BASE TABLE'
      where c.table_schema = 'public'
        and c.data_type = 'uuid'
        and c.column_name in
            ('user_id','created_by','awarded_by','completed_by','decided_by','invited_by')
    loop
      if _col.is_nullable = 'YES' then
        execute format('update public.%I set %I = null where %I = $1',
                       _col.table_name, _col.column_name, _col.column_name) using _victim;
      else
        execute format('delete from public.%I where %I = $1',
                       _col.table_name, _col.column_name) using _victim;
      end if;
    end loop;

    delete from auth.users where id = _victim;
    _n := _n + 1;
    raise notice 'Removida: %', _email;
  end loop;

  raise notice 'Total de contas removidas: %', _n;
end $$;


-- ------------------------------------------------------------
-- PASSO 3 — Confira o resultado
-- ------------------------------------------------------------
-- select email from auth.users;                         -- deve sobrar só 1
-- select name, code from public.workspaces;             -- workspaces mantidos
-- select name from public.people where user_id is null; -- pessoas desvinculadas


-- ------------------------------------------------------------
-- OPCIONAL — apagar um workspace de teste específico
-- ------------------------------------------------------------
-- Só se você quiser mesmo remover o workspace (apaga demandas, pontos,
-- presenças, times e tudo dentro dele — não tem desfazer):
--
-- delete from public.workspaces where code = 'CODIGO_AQUI';
