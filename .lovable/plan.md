

# Plano: Participantes em Projetos, Estatísticas no Dashboard, Exclusão de Itens

## Resumo
Adicionar campo "participantes" (multi-select de membros) nos projetos (removendo "equipe"), exibir estatísticas de pessoas no dashboard, permitir exclusão de qualquer item com confirmação, e renomear gráfico do dashboard.

## Mudanças no Banco de Dados

**Migration**: Adicionar coluna `members text[] NOT NULL DEFAULT '{}'` na tabela `projects` para armazenar participantes selecionados. A coluna `team` existente pode permanecer (será ignorada no código).

## Mudanças no Código

### 1. Tipo Project e DataContext
- Adicionar `members: string[]` ao tipo `Project`, remover `team`
- Adicionar `deleteProject` ao DataContext (atualmente ausente)
- Expor `deleteProject` no Provider

### 2. ProjectModal
- Remover seletor de equipe
- Adicionar multi-select de participantes usando `allMembers` do DataContext (checkboxes com nomes de todos os membros de todas as equipes)
- Salvar/carregar `members` no projeto

### 3. ProjectsPage
- Mostrar participantes em vez de equipe nos cards
- Adicionar botão de exclusão (X) com hover + confirmação via AlertDialog

### 4. Dashboard — Novas estatísticas de pessoas
- Card: total de pessoas em projetos ativos / total de membros
- Card ou seção: pessoas sem nenhum projeto
- Lista: pessoas em mais de 1 projeto
- Renomear "Produtividade por Equipe" para "Tarefas Concluídas por Equipe" (manter mesmo gráfico, só muda título)

### 5. Exclusão em todas as páginas
- **TasksPage**: Adicionar botão X com hover em cada card de tarefa, com AlertDialog de confirmação chamando `deleteTask`
- **ContentPage**: Mesmo padrão para posts, chamando `deletePost`
- **ProjectsPage**: Mesmo padrão chamando `deleteProject`
- **CalendarPage**: Nos pills do calendário, mostrar X no hover que chama a função de delete apropriada (deleteTask/deletePost/deleteEvent/deleteGeneralItem) com confirmação

### 6. Componente de confirmação de exclusão
- Criar um pequeno componente reutilizável usando AlertDialog para "Tem certeza que deseja excluir?" com botões Cancelar/Excluir

## Arquivos afetados
- `supabase/migrations/` — nova migration para coluna `members` em `projects`
- `src/contexts/DataContext.tsx` — tipo Project, deleteProject, members
- `src/components/modals/ProjectModal.tsx` — multi-select participantes
- `src/pages/ProjectsPage.tsx` — exibir participantes, botão excluir
- `src/pages/DashboardPage.tsx` — stats de pessoas, renomear gráfico
- `src/pages/TasksPage.tsx` — botão excluir
- `src/pages/ContentPage.tsx` — botão excluir
- `src/pages/CalendarPage.tsx` — botão excluir nos pills
- Novo: `src/components/DeleteConfirmDialog.tsx`

