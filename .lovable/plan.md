

# Plano: Forçar Fuso Horário de Brasília (America/Sao_Paulo)

## Resumo
Criar helpers de data no fuso `America/Sao_Paulo` e substituir `new Date()` nos pontos onde o app calcula "hoje" para comparações de prazo e exibição de calendário. Nenhuma mudança visual.

## Mudanças

### 1. `src/lib/utils.ts` — adicionar 2 funções
- `getNowBrasilia()`: retorna `Date` no horário de Brasília via `toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })`
- `getTodayBrasilia()`: retorna string `yyyy-MM-dd` em Brasília

### 2. Substituir `new Date()` por helpers em:
- **`DashboardPage.tsx`** — variáveis `today`/`todayDate`
- **`TasksPage.tsx`** — comparação de deadline na função `getDeadlineBorderClass`
- **`CalendarPage.tsx`** — estado inicial do calendário
- **`DataContext.tsx`** — geração de notificações

Apenas troca interna de referência de data. Zero mudança visual ou de layout.

