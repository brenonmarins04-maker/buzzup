## Mudanças no Calendário (mobile e estacionamento)

### 1. Long-press de 200ms para arrastar no mobile
- Implementar drag por toque com `pointerdown` + timer de 200ms.
- Após segurar 200ms, a publicação "gruda" no dedo (ghost flutuante seguindo a posição).
- Vibração curta (10ms) ao ativar o arrasto, se disponível.
- Soltar em qualquer dia do calendário ou no estacionamento.
- Cancelar se o usuário mover o dedo antes dos 200ms (= rolagem normal).

### 2. Estacionamento recolhível como "filete"
- Trocar o esconder total por uma aba vertical fina (~28px de largura no desktop, barra horizontal fina no mobile).
- Mostra ícone + contador de ideias estacionadas.
- Clicar no filete reabre o painel completo.
- Mantém drop ativo no filete (arrastar uma publicação até o filete também estaciona).

### 3. Mais texto visível nas células do calendário no mobile
- No mobile, aumentar a fonte das pílulas de `10px` para `11px` e o padding lateral.
- Mostrar 2-3 caracteres a mais antes do truncar (mudando de `truncate` por linha única para wrap em até 2 linhas no mobile).
- Aumentar levemente a altura mínima de cada célula de dia no mobile.

### 4. Lista "Próximos dias" abaixo do calendário (apenas mobile)
- Nova seção visível só em telas <768px, abaixo da grade do mês.
- Mostra os próximos **7 dias a partir de hoje** (atualiza automaticamente conforme a data).
- Cada dia agrupa: tarefas + publicações + eventos daquele dia, ordenados por horário.
- Dias sem itens são omitidos para economizar espaço.
- Cada item é clicável (abre o modal correspondente) e mostra: cor do tipo, título completo, horário (se houver), status (se for post).
- Cabeçalho de cada dia: "Hoje" / "Amanhã" / "Sex, 15 mai".

### Detalhes técnicos
- **Long-press**: novo hook `useLongPressDrag` em `src/hooks/`, registra `pointerdown/move/up/cancel`, cria elemento ghost via `document.createElement` posicionado com `transform: translate(x,y)`, faz hit-test com `document.elementFromPoint` para descobrir o dia/zona embaixo do dedo. Usa `data-drop-day="YYYY-MM-DD"` e `data-drop-parking="1"` nos targets.
- **Filete**: condicional no JSX que renderiza, em vez de `aside`, um `button` fino full-height com ícone `PanelLeftOpen` + badge de contagem.
- **Próximos dias**: novo componente interno `UpcomingList` com `useMemo` filtrando `allItems` para `date >= hoje && date <= hoje+6dias`, agrupado por data.

### Arquivos afetados
- `src/pages/CalendarPage.tsx` (estacionamento, células maiores, lista de próximos dias, integração do drag)
- `src/hooks/useLongPressDrag.ts` (novo)
