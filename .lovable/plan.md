# Plano: Membros, Convites e correções de workspace

## 1. Remover criação legada de workspace em `DataContext.tsx`

Trecho atual (linhas ~170–177) faz `select` em `workspaces` por `user_id` e, se vazio, faz `INSERT` direto criando "Meu Workspace" — sem registro em `workspace_members`, gerando workspace órfão.

Mudanças:
- Apagar o `select`/`insert` direto em `workspaces`.
- Usar `workspaceId` vindo do `AuthContext` (já populado por `fetchMembership` via `workspace_members`).
- Se `workspaceId` estiver null após `AuthContext` carregar, **não** criar nada: `ProtectedRoute` já redireciona para `/welcome`. Apenas limpar listas e sair.
- `DataProvider` passa a depender de `useAuth().workspaceId` em vez de buscar o próprio.

Resultado: única forma de criar workspace = RPC `create_workspace` (WelcomePage). Única forma de entrar = RPC `accept_workspace_invite`.

## 2. Nova rota `/members` — "Membros e Convites"

- Adicionar em `App.tsx` dentro de `ProtectedApp`.
- Adicionar item no `navItems` de `AppLayout.tsx` (sidebar + bottom nav) com ícone `Users` (renomear "Pessoas" para evitar conflito? Manter "Pessoas" e adicionar "Acessos" com ícone `Shield`).
- Página visível para todos os roles; conteúdo administrativo condicional.

### Layout da página (`src/pages/MembersPage.tsx`)

Duas seções/tabs:

**a) Membros**
- Lista vinda de `workspace_members` JOIN `profiles` (por `user_id`):
  - Nome (display_name), role badge (Owner/Admin/Member), data de entrada (`created_at`).
  - E-mail: **não disponível via RLS** (auth.users é restrito). Mostrar só nome + role; deixar nota no resumo final como pendência (precisaria de view security-definer).
- Ações por linha (somente se permitido):
  - Owner vendo member → "Promover a admin" + "Remover".
  - Owner vendo admin → "Rebaixar para member" + "Remover".
  - Owner vendo owner → nenhuma ação (e nunca permitir remover a si mesmo se for único owner — desabilitar no front; RPC já bloqueia owner).
  - Admin vendo member → "Remover".
  - Admin vendo admin/owner → sem ações.
  - Member → sem ações.
- Chamadas:
  - `update_member_role(_workspace_id, _target_user, _new_role)`
  - `remove_workspace_member(_workspace_id, _target_user)`

**b) Convites**
- Lista de `workspace_invites` do workspace atual (RLS já restringe a admins/owners).
- Colunas: role, criado por (lookup em `profiles`), criado em, expira em, usos (`used_count`/`max_uses`), status.
- **Não exibir `code_hash` nem código em claro** (impossível recuperar — é hash).
- Botão "Revogar" se status=active e usuário tem permissão (owner sempre; admin só nos que ele criou de member — RPC valida).
- Botão "Gerar convite" no topo:
  - Owner: opção Admin ou Member.
  - Admin: apenas Member.
  - Member: botão oculto.
- Modal de criação: role, validade (1h / 24h / 7d → enviar `_expires_in_hours`), `max_uses` (default 1, limitado a 50 pelo RPC para member; admin ignora e força 1).
- Ao confirmar, chamar `create_workspace_invite` → mostrar `AlertDialog` com o código retornado, botão "Copiar", aviso "Este código será exibido apenas uma vez. Envie manualmente por WhatsApp/mensagem."
- `revoke_workspace_invite(_workspace_id, _invite_id)` no botão revogar.

## 3. Seletor leve de multi-workspace

Hoje `get_workspace_id` retorna sempre o mais antigo; não vou refatorar RLS agora.

Mínimo viável:
- Em `AuthContext.fetchMembership`, buscar **todas** memberships ativas (lista completa) além da "ativa".
- Expor `memberships: {workspace_id, role, workspace_name}[]` e `setActiveWorkspace(id)`.
- A "ativa" sai de `localStorage("buzzup.activeWorkspace")` se válida (existe na lista), senão a mais antiga.
- Em `AppLayout`, se `memberships.length > 1`, mostrar dropdown simples no header com nome + role; trocar atualiza estado + storage e dispara reload de dados.
- **Limitação importante (deixar claro no resumo):** RLS continua usando `get_workspace_id` (mais antigo). Então trocar workspace no front **não muda** o que o backend retorna até refatorar `get_workspace_id` para aceitar parâmetro e/ou trocar policies para `EXISTS workspace_members`. Por isso o seletor só faz sentido completo após Fase 2. Decisão: **adiar o seletor** e apenas listar memberships em uma área de Settings? Ver pergunta abaixo.

## 4. Páginas órfãs (`ProjectsPage`, `TasksPage`, `ContentPage`, `TeamsPage`, `GamificationAdminPage`)

Investigação rápida mostra:
- `TeamsPage` e `GamificationAdminPage` **já são usados** como sub-tabs dentro de `PeoplePage` — não são órfãs reais.
- `ProjectsPage`, `TasksPage`, `ContentPage`: aparentam ser resquícios anteriores ao redesign por áreas. **Não conectar.** Listar no resumo como "candidatos a remoção em PR futuro".

## 5. Segurança preservada

- Continua: role lido de `workspace_members`, convites por RPC com hash bcrypt, RLS por `workspace_id` + `is_workspace_admin`.
- UI só esconde botões; toda ação sensível é RPC `SECURITY DEFINER` que revalida role.
- Nada em `localStorage` representa permissão — apenas preferência de workspace ativo (validada contra banco).

## 6. Arquivos a tocar

- `src/contexts/DataContext.tsx` — remover criação legada, consumir `workspaceId` do AuthContext.
- `src/contexts/AuthContext.tsx` — buscar `memberships[]`, expor `setActiveWorkspace` (se confirmarmos seletor).
- `src/pages/MembersPage.tsx` — novo.
- `src/components/modals/CreateInviteModal.tsx` — novo.
- `src/components/modals/InviteCodeDialog.tsx` — novo (exibir código uma única vez).
- `src/App.tsx` — registrar rota `/members`.
- `src/components/AppLayout.tsx` — adicionar item de menu "Acessos" (sidebar + bottom-nav).

## 7. Testes manuais (a executar após build)

Conforme o roteiro do pedido — criar workspace, owner convidar admin/member, admin convidar member, member sem ações, convite usado/revogado, código antigo sem efeito, sem criação automática de workspace, build limpo.

## Perguntas antes de implementar

1. **Seletor de multi-workspace agora?** Como `get_workspace_id` ainda retorna só o mais antigo, trocar workspace no front **não muda** o que o backend devolve até refatorarmos RLS/RPC. Opções:
   (a) Só implemento listagem de memberships (read-only) em Configurações + deixo como pendência clara.
   (b) Implemento o seletor cosmético sabendo que ele só funcionará 100% depois da Fase 2.
   (c) Refatoro `get_workspace_id` para aceitar `_workspace_id` explícito e ajusto as policies de `workspace_members` para validar membership por `EXISTS` (mudança grande, mas o pedido permite "o máximo possível sem quebrar o app").

2. **E-mail dos membros na tela**: `auth.users` é inacessível via Data API. Posso (a) só mostrar `display_name`, (b) criar função `SECURITY DEFINER` que retorna `{user_id, email, display_name}` apenas para membros do workspace. Preferência?

3. **Local do menu**: "Acessos" como item próprio na sidebar/bottom-nav, ou aba dentro de `/people` (já tem Membros/Equipes/Gamificação/Histórico)? A confusão é que "Pessoas/Membros" hoje são entidades de negócio, não usuários autenticados.
