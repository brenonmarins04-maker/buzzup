

# Plano: Reformular Dashboard — Gráficos e Cards

## Resumo
Adicionar gráfico de tarefas concluídas por pessoa, substituir cards superiores por um gráfico de pizza de alocação em projetos, e renomear seções.

## Mudanças em `src/pages/DashboardPage.tsx`

### 1. Remover os 4 cards superiores
Remover completamente a grid com "Concluídas", "Posts", "Em Projetos" e "Prazos" (linhas 120-154).

### 2. Renomear "Alocação de Pessoas" → "Pessoas em Projetos"
Na seção que lista pessoas sem projeto e em múltiplos projetos, trocar o título.

### 3. Adicionar gráfico de pizza — Pessoas em Projetos
Novo gráfico de pizza com 3 categorias:
- **Vermelho** (`#ef4444`): pessoas que não estão em nenhum projeto
- **Verde** (`#22c55e`): pessoas que estão em exatamente 1 projeto
- **Rosa choque** (`#ec4899`): pessoas que estão em 2+ projetos

Será colocado ao lado da seção "Pessoas em Projetos", substituindo ou complementando a listagem atual.

### 4. Adicionar gráfico de barras — Tarefas Concluídas por Pessoa
Novo gráfico de barras mostrando, para cada membro (`allMembers`), quantas tarefas com `status === "done"` possuem esse membro no campo `responsible`. Ordenado do maior para o menor. Exibido na grid de gráficos ao lado do existente "por Equipe".

### Lógica de dados
- **Por pessoa**: Iterar `allMembers`, contar tarefas done onde `task.responsible.includes(member)`. Ordenar desc.
- **Pizza de alocação**: Calcular quantos membros têm 0, 1, ou 2+ projetos ativos.

### Arquivos afetados
- `src/pages/DashboardPage.tsx` — único arquivo modificado

