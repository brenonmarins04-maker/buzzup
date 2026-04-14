

# Plano: Reestruturação Completa — Workspace + People + Junction Tables

## Resumo
Migrar de `user_id` com arrays de texto para um modelo relacional com `workspaces`, `people`, e tabelas de junção (`project_participants`, `task_assignees`, `post_assignees`). Manter layout e UX intactos.

## Estado Atual
- Auth funciona (email/senha, auto-confirm)
- Tabelas usam `user_id` direto com RLS
- Membros/responsáveis armazenados como `text[]` em teams, tasks, posts, projects
- Tudo já persiste no Supabase

## Fase 1 — Migração SQL (1 migration)

### Novas tabelas
```text
workspaces (id, user_id → auth.users, name, created_at)
people (id, workspace_id → workspaces, name, created_at)
project_participants (id, project_id → projects, person_id → people)
task_assignees (id, task_id → tasks, person_id → people)
post_assignees (id, post_id → posts, person_id → people)
```

### Tabelas existentes — alterações
- `projects`: remover `team`, `members`; adicionar `workspace_id`; remover `user_id`
- `tasks`: manter `team` (texto livre); remover `responsible`; adicionar `workspace_id`; remover `user_id`
- `posts`: remover `responsible`; adicionar `workspace_id`; remover `user_id`
- `calendar_events` → renomear para `calendar_items`: adicionar `workspace_id`; remover `user_id`; remover `time`, `end_time`
- `general_items`: remover (fusionar com calendar_items como type)
- `channels`: `workspace_id` em vez de `user_id`
- `categories`: `workspace_id` em vez de `user_id`
- Dropar tabela `teams` (pessoas agora vivem em `people`)

### Trigger
- `handle_new_user()`: além de criar profile, criar workspace automaticamente

### RLS em todas as tabelas
- Função `get_workspace_id(uid)` retorna o workspace_id do user
- Policies: `workspace_id = get_workspace_id(auth.uid())`
- Junction tables: policy via subquery no parent table

## Fase 2 — Tipos e DataContext

### Novos tipos
```text
Person { id, name }
```

### DataContext reescrito
- Buscar `workspace_id` do user no mount
- Queries filtram por `workspace_id`
- `people`: CRUD completo (substitui team members)
- `projects`: joins com `project_participants` + `people`
- `tasks`: joins com `task_assignees` + `people`
- `posts`: joins com `post_assignees` + `people`
- `allMembers` derivado de `people`
- Inserts usam `workspace_id` em vez de `user_id`
- Junction tables gerenciadas em cascata (ao salvar task, sync assignees)

## Fase 3 — Páginas e Modais

### TeamsPage → PeoplePage
- Renomear para "Pessoas"
- Lista simples de pessoas do workspace (add, edit, delete)
- Sem conceito de "equipe" como container — pessoas são globais

### TaskModal
- Responsáveis: multi-select de `people` (em vez de `allMembers` string)
- Ao salvar: insert task + upsert `task_assignees`

### PostModal
- Responsáveis: multi-select de `people`
- Ao salvar: insert post + upsert `post_assignees`

### ProjectModal
- Participantes: multi-select de `people`
- Remove campo "equipe"
- Ao salvar: insert project + upsert `project_participants`

### TasksPage
- Filtro por equipe (texto) permanece
- Aba "Concluídas" já existe

### ContentPage
- Aba "Concluídas/Publicadas" já existe

### ProjectsPage
- Aba "Concluídos" já existe
- Participantes mostram nomes de `people`

### DashboardPage
- Gráficos adaptados para usar `people` em vez de team members

### CalendarPage
- Usar `calendar_items` (sem general_items separado)

## Fase 4 — Limpeza
- Remover `src/lib/mock-data.ts`
- Remover tipo `GeneralItem` (fundido com CalendarEvent/calendar_items)
- Remover modal `GeneralItemModal` (usar EventModal com campo `type`)
- Atualizar rotas (teams → people)

## Arquivos afetados
- 1 migration SQL (novas tabelas, alterações, RLS, triggers)
- `src/contexts/DataContext.tsx` — reescrita completa
- `src/pages/TeamsPage.tsx` → `PeoplePage.tsx`
- `src/pages/TasksPage.tsx`, `ContentPage.tsx`, `ProjectsPage.tsx`, `CalendarPage.tsx`, `DashboardPage.tsx`
- `src/components/modals/TaskModal.tsx`, `PostModal.tsx`, `ProjectModal.tsx`, `EventModal.tsx`
- `src/components/modals/GeneralItemModal.tsx` — remover
- `src/components/AppLayout.tsx` — rota/nav "Pessoas"
- `src/App.tsx` — rota `/people`

## Nota sobre dados existentes
Os dados atuais no banco serão perdidos pois a estrutura muda completamente (drop de colunas, tabelas). Se houver dados importantes, precisam ser migrados manualmente antes.

