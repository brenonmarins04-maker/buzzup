## Objetivo

Tornar o estacionamento mais dinâmico no `CalendarPage`:

1. **Criação rápida no estacionamento** já existe (input "Nova ideia + Enter"), mas vou reforçar o feedback e garantir que funcione bem:
   - Manter o foco no input após criar (para criar várias seguidas).
   - Mostrar um pequeno toast de confirmação.
   - Garantir que o item recém-criado apareça no topo da lista.

2. **Arrastar publicações do calendário de volta para o estacionamento**:
   - Tornar o painel do estacionamento (aside) um drop target.
   - Ao soltar uma publicação ali, definir `date = ""` e `time = ""` → ela some do calendário e aparece na lista.
   - Tarefas e eventos não podem ser estacionados (estacionamento é só de posts) → mostrar feedback "Apenas publicações podem ser estacionadas" e ignorar o drop.
   - Destaque visual no aside enquanto há um post sendo arrastado por cima (ring + bg sutil).

## Arquivos afetados

- `src/pages/CalendarPage.tsx` — única alteração; tudo é UI/handlers de drag-and-drop, sem mudanças de schema nem em outros componentes.

## Detalhes técnicos

- Novo handler `handleParkingDragOver` / `handleParkingDrop` no `<aside>` do estacionamento.
- No drop: se `dragItem.type !== "post"` → `toast.error` e retorna; senão `updatePost({ ...post, date: "", time: "" })`.
- Novo state `parkingDropActive: boolean` para o highlight visual.
- Ajuste no `handleQuickIdea` para refocar o input via `ref` após submit.
