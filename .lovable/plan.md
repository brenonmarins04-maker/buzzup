## Redesign da página Início

Reformular `src/pages/DashboardPage.tsx` para refletir o layout da referência, mantendo paleta vibrante já existente (áreas + primary blue).

### Estrutura (de cima para baixo)

1. **Hero "Saudação + ilustração"**
   - Card grande arredondado, fundo suave (gradient com tons da paleta).
   - Esquerda: ilustração/gráfico decorativo (SVG inline minimal — linha de tendência + check verde).
   - Direita: "Olá, {primeiro nome}! 👋" + subtítulo "Aqui está o resumo do que está acontecendo no workspace."
   - Sem botões (conforme escolha).

2. **Card de Mensagem geral (somente se houver broadcast ativo)**
   - Renderizado abaixo do hero como card destacado (borda colorida + ícone megafone).
   - Lê do contexto/`broadcasts` ativo (já existe `BroadcastBar`). Se não houver, não renderiza.

3. **4 KPIs em grid (cards com ícone + valor + variação)**
   - Tarefas em andamento
   - Projetos ativos
   - Eventos da semana (hoje → fim da semana)
   - Publicações agendadas (posts com status agendado e data futura)
   - Cada card mostra `+X% vs. semana anterior` comparando snapshot atual vs valor calculado para a data de 7 dias atrás (ex.: tarefas em andamento 7 dias atrás = tarefas criadas antes daquela data e ainda não concluídas naquele momento; projetos ativos = projetos criados antes daquela data com status active; eventos da semana = eventos da semana anterior; posts agendados = comparados há 7 dias). Cor verde se positivo, vermelho se negativo, cinza se igual.
   - Cada KPI tem mini sparkline (área) opcional usando recharts.

4. **Grid 3 colunas (lg) / stack (mobile)**
   - **Projetos ativos** — lista com ícone da área, nome, barra de progresso (tarefas done / total do projeto), %. Link "Ver todos".
   - **Tarefas por pessoa** — top pessoas com avatar inicial, contagem done/total (semana atual) e barra de progresso. Link "Ver todas".
   - **Eventos da semana** — lista compacta com data lateral (DIA/MÊS) e badge do tipo do evento. Link "Ver calendário".

5. **Grid 2 colunas (lg)**
   - **Gamificação — Ranking** (mantido) com medalhas e pontos.
   - **Atividade recente** — feed unificado das últimas N (10) ações: tarefas concluídas, projetos criados, eventos agendados, comunicados publicados. Ícone + texto + "Há X horas/dias" (usando `created_at` das tabelas; para tarefas concluídas usa-se proxy `created_at` da tarefa cujo status=done — limitação, mas suficiente). Ordenação por timestamp desc.

### Detalhes técnicos

- Arquivo único: `src/pages/DashboardPage.tsx` (rewrite).
- Usar tokens semânticos do design system (`bg-card`, `border-border`, `text-foreground`, etc.) + cores de área via classes `text-area-*`/`bg-area-*` já criadas.
- Cálculo de KPIs e "vs. 7 dias atrás": funções puras dentro do componente usando `useMemo` sobre `tasks`, `projects`, `events`, `posts` (já disponíveis em `useData`).
- Feed de atividade: merge ordenado de 4 fontes mapeadas para `{ type, label, timestamp, icon, color }`.
- Broadcast: ler do `useData` ou hook existente. Verificar `src/components/BroadcastBar.tsx` para reaproveitar lógica de fetch.
- Responsivo: grids colapsam para 1 coluna em mobile, hero empilha imagem em cima.
- Sem novas dependências, sem mudanças no DB.

### Fora de escopo
- Mudanças no AppLayout, navegação, ou outras páginas.
- Novos botões de ação rápida no hero (usuário preferiu ilustração).
