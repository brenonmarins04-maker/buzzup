

# Plano: Filtros Multi-Selecionáveis Inline (Toggle Chips)

## Resumo
Substituir todos os `<select>` de filtro por botões/chips clicáveis inline que permitem selecionar múltiplos valores simultaneamente, sem popup.

## Abordagem
Criar um componente reutilizável `FilterChips` que renderiza uma lista de botões inline. Cada botão pode ser toggled (ativo/inativo). Quando nenhum está selecionado, mostra tudo (equivalente a "all").

### Componente `src/components/FilterChips.tsx`
```tsx
// Props: options: {value, label}[], selected: string[], onChange: (selected: string[]) => void
// Renderiza chips inline clicáveis com visual ativo/inativo
```

## Páginas afetadas

### `src/pages/TasksPage.tsx`
- `filterTeam: string` → `filterTeams: string[]`
- Substituir `<select>` por `<FilterChips>` com lista de equipes
- Filtro: se `filterTeams.length === 0`, mostra tudo; senão filtra por inclusão

### `src/pages/ContentPage.tsx`
- `filterChannel: string` → `filterChannels: string[]`
- `filterStatus: string` → `filterStatuses: string[]`
- Dois grupos de `<FilterChips>`: canais e status

### `src/pages/CalendarPage.tsx`
- `filterTeam: string` → `filterTeams: string[]`
- `filterType: string` → `filterTypes: string[]`
- Dois grupos de `<FilterChips>`: equipes e tipos

## Arquivos
- Novo: `src/components/FilterChips.tsx`
- Editados: `TasksPage.tsx`, `ContentPage.tsx`, `CalendarPage.tsx`

