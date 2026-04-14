

# Plano: UX de Criação Rápida — ENTER, Fluxo Contínuo e Memória

## Resumo
Melhorar a experiência de criação em todos os modais: ENTER salva, modal não fecha (modo criação), campos limpam automaticamente, e o sistema lembra a última equipe/canal selecionados.

## Mudanças

### 1. Memória de escolhas — novo hook `useFormMemory`
Criar `src/hooks/useFormMemory.ts` que usa `localStorage` para guardar e recuperar `lastTeam` e `lastChannel`. Atualizado ao salvar qualquer item.

### 2. TaskModal — fluxo contínuo + ENTER + memória
- Wrap conteúdo em `<form onSubmit>` para capturar ENTER
- Textarea usa `onKeyDown` para SHIFT+ENTER = quebra de linha, ENTER sozinho = submit
- Após salvar **novo** item: limpar campos (manter `team` da memória e `deadline`), focar no input de título via `useRef`
- Após salvar **edição**: fechar modal normalmente
- Criação mínima: apenas título + data (já funciona, só remover validação extra se houver)
- Atualizar memória de `lastTeam` ao salvar

### 3. PostModal — fluxo contínuo + ENTER + memória
- Mesmo padrão: `<form>`, ENTER salva, SHIFT+ENTER quebra linha
- Após criar: limpar campos, manter `channel` e `category` da memória, focar título
- Edição: fecha normalmente
- Criação mínima: título + data
- Atualizar memória de `lastChannel` ao salvar

### 4. TeamsPage (adicionar pessoa) — fluxo contínuo + ENTER
- Modal "Adicionar Pessoa": `<form onSubmit>`, ENTER salva
- Após salvar: limpar nome, manter modal aberto no mesmo time, focar input
- Permitir adicionar várias pessoas em sequência

### 5. EventModal e GeneralItemModal — ENTER support
- Adicionar `<form onSubmit>` para ENTER = salvar
- SHIFT+ENTER em textareas = quebra de linha
- Esses modais fecham após salvar (sem fluxo contínuo, pois são menos frequentes)

### 6. ESC
- Já funciona nativamente pelo Dialog do Radix — nenhuma mudança necessária

## Arquivos afetados
- Novo: `src/hooks/useFormMemory.ts`
- Editados: `TaskModal.tsx`, `PostModal.tsx`, `EventModal.tsx`, `GeneralItemModal.tsx`, `TeamsPage.tsx`

