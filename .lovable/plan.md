
# Reestruturação do BuzzUp

## 1. Nova navegação (bottom nav)
`Início · Calendário · Pessoas · Projetos · Mercado · GG · Presidência`

Remove abas atuais: Tarefas (vira "Demandas" dentro do Calendário e dentro de cada área), Conteúdo, Equipes (move para dentro de Pessoas), Gamificação admin (move para dentro de Pessoas como "Apelidos").

## 2. Modelo de dados — nova dimensão "Área"
Áreas: `projetos`, `mercado`, `gg`, `presidencia`. Convivem com Equipes (não substituem).

Novos campos:
- `people.area` (text, nullable) — área principal da pessoa
- `tasks.area` (text, nullable) — área da tarefa/demanda
- `calendar_items.area` (text, nullable) — opcional p/ filtrar
- Nova tabela `area_notes` (id, workspace_id, area, name, url, position)
- Nova tabela `parking_items` (id, workspace_id, area, person_id nullable, title, description, position) — alimenta o Quadro CB. `person_id = null` ⇒ está no Estacionamento; senão, está na coluna daquele membro.

## 3. Início (novo)
Três blocos, nessa ordem:
1. **Ranking de Gamificação** (mantém atual, corrigir grafia "Gamificação")
2. **Projetos** — cards/lista de projetos ativos (reaproveita ProjectsPage resumido)
3. **Tarefas por pessoa (ativas)** — gráfico de barras agrupadas: 2 barras por pessoa (Não começada cinza, Em andamento laranja). Tarefas concluídas ignoradas.
4. **Eventos da semana** — lista dos eventos do calendário do dia atual até domingo (fim de semana America/Sao_Paulo).

Remove "Atenção hoje" e qualquer card de "tarefas concluídas por pessoa".

## 4. Calendário
- Renomear "Estacionamento" → **Ideias gerais** em toda UI.
- Aba **Demandas** (substitui visão de tarefas): chips de filtro com as 4 áreas (single-select). Mostra só demandas da área selecionada. Botão "+" cria demanda já com `area` preenchida da seleção atual.
- Mantém visão de calendário existente.

## 5. Pessoas — 3 sub-abas
- **Apelidos** (só admin) — conteúdo atual de GamificationAdminPage.
- **Equipes** — conteúdo atual de TeamsPage.
- **Membros** — conteúdo atual de PeoplePage. Clicar no nome abre modal com: nome, **Área** (select dos 4) e **Equipe** (select). Salvar atualiza `people.area` e `team_members`.

## 6. Áreas (Projetos, Mercado, GG, Presidência) — página única reutilizada
Cada uma é a mesma página parametrizada por `area`. Duas abas internas:

### 6.1 Notas
- Lista de "atalhos": cada item é um botão grande com **nome** visível (URL escondida).
- Clicar abre URL em nova aba (`target=_blank`).
- Admin pode adicionar/editar/remover (nome + URL).

### 6.2 Quadro CB
Layout horizontal scrollável:
```text
[ Estacionamento ] [ Membro A ] [ Membro B ] [ Membro C ] ...
       ↑                  ↑           ↑
   parking_items    person_id=A   person_id=B
```
- Colunas = membros da área (`people.area = <area>`) + 1 coluna fixa "Estacionamento" à esquerda.
- Cards = `parking_items` daquela área, agrupados por `person_id`.
- Drag-and-drop livre: estacionamento↔membro, membro↔membro, membro↔estacionamento. Mover card = update `person_id` (null para estacionamento).
- Admin cria/edita/remove cards. Cards mostram título + descrição curta.

## 7. Permissões
- Admin: tudo (incluindo Apelidos, criar notas-link, mover/criar cards CB, mudar área de membros).
- Membro: leitura + drag de cards no Quadro CB (decidir: por enquanto **leitura apenas** para manter padrão atual em que só admin escreve; cards movidos via admin). Confirmaremos no build se quiser permitir drag para todos.

## 8. Detalhes técnicos

**Migrations**
- `ALTER TABLE people ADD COLUMN area text`
- `ALTER TABLE tasks ADD COLUMN area text`
- `ALTER TABLE calendar_items ADD COLUMN area text`
- `CREATE TABLE area_notes (...)` + GRANTs + RLS (select para members, write para admins)
- `CREATE TABLE parking_items (...)` + GRANTs + RLS idem

**Rotas novas** (`src/App.tsx`):
- `/projetos`, `/mercado`, `/gg`, `/presidencia` → `<AreaPage area="..."/>` (componente único)
- `/pessoas` continua, mas página vira tabs (Apelidos/Equipes/Membros)
- Remove `/tasks`, `/content`, `/teams`, `/gamification` (ou redireciona internamente)

**Componentes novos**
- `src/pages/AreaPage.tsx` (Notas + Quadro CB)
- `src/components/area/AreaNotesTab.tsx`
- `src/components/area/AreaKanbanTab.tsx` (HTML5 drag-and-drop, sem libs novas)
- `src/components/area/AreaFilterChips.tsx` (reuso para Demandas)
- `src/pages/PeoplePage.tsx` refatorado para tabs
- `src/components/modals/MemberEditModal.tsx` (nome + área + equipe)

**Atualizações**
- `DataContext`: adicionar `areaNotes`, `parkingItems`, `area` em people/tasks; CRUD + realtime das 2 novas tabelas
- `DashboardPage`: substituir conteúdo conforme item 3
- `CalendarPage`: renomear "Estacionamento"→"Ideias gerais", adicionar aba Demandas com filtro por área
- `AppLayout`: nova bottom nav (7 itens — avaliar overflow em mobile; possivelmente agrupar as 4 áreas em um menu "Áreas" se necessário no mobile)

**Bottom nav mobile**: com 7 itens fica apertado. Proposta: `Início · Calendário · Pessoas · Áreas ▾ · +`, onde "Áreas" abre folha com Projetos/Mercado/GG/Presidência. No desktop mostra todos os 7.

**Gamificação**: nome correto = "Gamificação" (já está). Verificar todos os labels.

## 9. Fora do escopo deste plano
- Reescrever lógica de pontuação (mantida).
- Mexer em Conteúdo/Posts (página `/content` será removida da nav; manter arquivo até confirmar que dados não são mais usados).

## 10. Ordem de execução
1. Migrations (área em people/tasks/calendar_items, area_notes, parking_items)
2. DataContext + tipos
3. Nova navegação + rotas + AreaPage skeleton
4. PeoplePage com tabs + MemberEditModal
5. Calendário (renome + aba Demandas com filtro)
6. Início (4 blocos novos)
7. Notas (atalhos)
8. Quadro CB (drag-and-drop)
9. QA visual + ajustes mobile
