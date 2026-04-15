

# Plano: Aba "Equipes" + Dashboard com métricas por equipe

## Resumo
Criar a funcionalidade de **Equipes** (agrupamentos de pessoas) com tabela no banco, página de gestão, e gráfico no dashboard mostrando tarefas concluídas por equipe. Renomear "Dashboard" para "Início".

## Fase 1 — Banco de Dados (1 migration)

Nova tabela `teams`:
```text
teams (id uuid PK, workspace_id uuid NOT NULL, name text NOT NULL, created_at timestamptz)
```

Nova tabela de junção `team_members`:
```text
team_members (id uuid PK, team_id uuid NOT NULL → teams, person_id uuid NOT NULL → people)
```

RLS em ambas usando `get_workspace_id(auth.uid())` (teams direto, team_members via EXISTS no parent).

Index em `teams.workspace_id`.

## Fase 2 — DataContext

Adicionar tipos:
```text
Team { id, name, members: Person[] }
```

Adicionar estado `teams` + fetch de `teams` e `team_members` no `fetchAll`.

Adicionar funções CRUD:
- `addTeam(name, memberIds)`
- `updateTeam(team)`
- `deleteTeam(id)`

Exportar `teams` no contexto.

## Fase 3 — Página TeamsPage (`/teams`)

- Lista de equipes com membros exibidos como badges
- Modal para criar equipe: nome + multi-select de pessoas
- Editar e excluir equipes
- Rota `/teams` no App.tsx
- Nav item "Equipes" com ícone `UsersRound` no AppLayout (sidebar e bottom nav mobile)

## Fase 4 — Dashboard → Início

- Renomear label no nav de "Dashboard" para "Início"
- Renomear h1 na página de "Dashboard" para "Início"
- Adicionar gráfico de barras "Tarefas Concluídas por Equipe":
  - Para cada equipe, somar tarefas concluídas de todos os seus membros (via `task_assignees`)
  - Exibir como bar chart horizontal ao lado do existente "por Pessoa"

## Arquivos afetados
- 1 migration SQL (tabelas `teams`, `team_members`, RLS, indexes)
- `src/contexts/DataContext.tsx` — tipos, fetch, CRUD de teams
- `src/pages/TeamsPage.tsx` — nova página
- `src/pages/DashboardPage.tsx` — renomear título + novo gráfico por equipe
- `src/components/AppLayout.tsx` — nav item "Equipes", label "Início"
- `src/App.tsx` — rota `/teams`
- `src/integrations/supabase/types.ts` — tipos atualizados

