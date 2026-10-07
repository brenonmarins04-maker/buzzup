# BuzzUp: diagnostico dos travamentos

Data: 01/10/2026. Versao investigada: `3af521b`.

## Causa confirmada em producao

A sessao autenticada em `https://usebuzzup.com.br` registrou repetidamente
`RangeError: Maximum call stack size exceeded` em 15:43:21-26 UTC.
A pilha alternava entre `removeChannel`, `unsubscribe` e o callback de status
de `DataContext`. Ao receber `CLOSED`, o callback removia novamente o mesmo
canal. A remocao emitia outro `CLOSED`, provocando recursao e novas tentativas.

O SDK tambem derivava o endereco WebSocket do proxy HTTP `/sb-proxy`.
Um teste de conexao desse endpoint falhou em 1227 ms; o endereco direto do
mesmo projeto Supabase conectou em 314 ms. A falha acionava o ciclo acima.

## Correcoes

- WebSocket usa diretamente o projeto Supabase. HTTP continua no proxy existente.
- A chave de armazenamento da sessao permanece igual: nao e necessario apagar
  dados do navegador nem invalidar logins para essa mudanca.
- Cada canal tem somente uma tentativa de reconexao pendente, espera progressiva
  de ate 60 segundos e descarte de callbacks de canais ja encerrados.
- Atualizacoes simultaneas de uma mesma tabela sao agrupadas. Uma consulta em
  andamento recebe no maximo uma atualizacao posterior, em vez de concorrentes.
- Respostas de workspaces anteriores sao ignoradas. Erros de consulta nao
  substituem listas existentes por listas vazias.
- A migracao legada de demandas nao cria registros quando uma das consultas
  usadas para verificar duplicidades falha.
- O protetor de cliques tambem detecta a remocao de portais de modal na mesma
  pagina, sem remover o bloqueio de um dialogo que continua aberto.

Nao ha migracao de banco, exclusao em massa, troca de IDs, alteracao de
responsaveis, pontuacoes ou permissoes nesta correcao.

## Verificacoes

- `npm test -- --maxWorkers=2`: 36 arquivos, 270 testes aprovados.
- 16 novos testes cobrem transporte, reconexao, agrupamento de consultas,
  preservacao dos dados e desbloqueio de modal.
- Simulacao com 120 quedas e cerca de duas horas de tempo virtual: nenhuma
  multiplicacao de canais ou timers; limpeza completa ao desmontar.
- Teste real do SDK no endereco direto: conectado em 628 ms, 65 segundos sem
  falhas, um canal ativo e zero canais depois da limpeza. Canal de diagnostico
  sem assinatura de tabelas e sem alteracoes de registros.
- `npm run build`: aprovado. Avisos existentes de tamanho de bundle e browserslist.
- ESLint dos novos modulos/testes, cliente e PointerGuard: aprovado.
- TypeScript global: 18 erros de tipos de tabelas Supabase ausentes. A compilacao
  da versao anterior (`HEAD`, com arquivos originais em memoria) apresentou os
  mesmos 18 erros nos mesmos arquivos. Nao foram introduzidos por esta correcao;
  atualizar os tipos gerados continua sendo uma pendencia separada.

## Limites

Tempo virtual testa o ciclo de reconexao, nao representa duas horas de
navegacao real. O teste direto valida o transporte, nao todas as regras RLS.
Depois da publicacao, abas ja abertas precisam ser recarregadas para abandonar
o JavaScript antigo. A correcao resolve a falha reproduzida, mas nao substitui
observacao em diferentes dispositivos e redes durante o uso prolongado.

Referencia sobre eventos DELETE: os filtros dependem de REPLICA IDENTITY FULL.
As assinaturas existentes foram preservadas, com descarte local dos eventos
de outros workspaces quando o payload inclui workspace_id.
<https://supabase.com/docs/guides/realtime/postgres-changes>
