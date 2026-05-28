# Refatoração de Autenticação, Membros e Permissões

Substituir o modelo atual (login compartilhado + código fixo de admin no localStorage/RPC) por um sistema profissional com **login individual**, **roles persistidas no banco** (`owner`/`admin`/`member`), **convites por código com hash** e **RLS estrita** que bloqueia qualquer ação proibida no servidor.

## 1. Mudanças no banco (migração SQL)

### Tabela `workspace_members`
- Adicionar role `owner` ao `CHECK` (hoje só `admin`/`member`/`viewer`).
- Adicionar coluna `status` (`active`/`removed`/`pending`).
- Garantir UNIQUE em `(workspace_id, user_id)`.
- Migrar dados existentes: o `user_id` dono do `workspaces.user_id` vira `owner`; demais membros `admin` permanecem `admin`; `viewer` vira `member`.
- Remover/desligar a coluna `workspaces.access_code` (manter como deprecated/null) e a RPC `redeem_access_code` + `demote_self_to_viewer`.
- Bloquear escrita direta com policy restritiva: nenhum INSERT/UPDATE/DELETE direto via PostgREST — tudo via RPC SECURITY DEFINER.

### Nova tabela `workspace_invites` (substitui a atual baseada em e-mail)
Recriar com: `id`, `workspace_id`, `code_hash`, `role` (`admin`|`member`), `created_by`, `expires_at`, `max_uses` (default 1), `used_count` (default 0), `status` (`active`|`used`|`expired`|`revoked`), `used_by`, `used_at`, timestamps. RLS: só owner/admin do workspace leem; escrita só via RPC.

### Nova tabela `activity_logs`
`workspace_id`, `user_id`, `action`, `target_type`, `target_id`, `metadata jsonb`, `created_at`. RLS: owner vê tudo; admin vê operacionais; member não vê.

### Funções helper (SECURITY DEFINER, search_path=public)
- `current_workspace_role(_ws uuid)` → retorna role do usuário no workspace.
- `is_workspace_owner(_user, _ws)` e atualizar `is_workspace_admin` para aceitar `owner` ou `admin`.
- `get_workspace_id` continua para retro-compatibilidade (workspace ativo = primeiro), mas RLS passa a usar checagem por `workspace_id` + role.

### RPCs (SECURITY DEFINER) — única forma de alterar permissões
- `create_workspace(name text)` → cria workspace + member `owner` + log.
- `create_workspace_invite(_ws uuid, _role text, _expires_in interval, _max_uses int)`:
  - owner pode criar `admin` ou `member`; admin só `member`; member bloqueado.
  - Gera código aleatório `EMPRESA-XXXXX` (charset seguro, ~40 bits), salva `code_hash = crypt(code, gen_salt('bf'))`, retorna o código **apenas uma vez**.
  - Default para `admin`: `max_uses=1`, `expires_in=1h`.
- `accept_workspace_invite(_code text)`:
  - Localiza convite ativo válido comparando hash, valida expiração/usos/status, valida que o usuário ainda não é membro, insere `workspace_members` com role do convite, incrementa `used_count`, marca `used` se atingir `max_uses`, registra log. Retorna `{workspace_id, role}`. Erros genéricos para evitar enumeration.
- `revoke_workspace_invite(_ws, _invite)`: owner revoga qualquer um; admin só convites de member que ele criou.
- `remove_workspace_member(_ws, _target_user)`: owner remove admin/member; admin remove só member; bloqueia remoção do último owner.
- `update_member_role(_ws, _target_user, _new_role)`: somente owner; não permite remover último owner; permite promover member↔admin; transferência de propriedade futura fora de escopo.

### RLS em tabelas operacionais
Reescrever policies de `tasks`, `projects`, `calendar_items`, `posts`, `post_assignees`, `task_assignees`, `project_participants`, `parking_items`, `area_notes`, `attendance_*`, `lead_thermometer`, `broadcasts`, `categories`, `channels`, `event_types`, `gamification_*`, `people`, `teams`, `team_members` para:
- SELECT: qualquer membro ativo do workspace.
- INSERT/UPDATE/DELETE: somente `owner` ou `admin` (`is_workspace_admin` atualizado para incluir owner).
- `member` nunca pode escrever.

## 2. Mudanças no front-end

### `AuthContext`
- Remover `accessCode`, `redeemCode`, `isAdmin` baseado em código, `demote_self_to_viewer`.
- Expor: `user`, `session`, `memberships: {workspace_id, workspace_name, role}[]`, `activeWorkspaceId` (persistido em `localStorage` apenas como preferência), `role` (derivada do membership ativo), helpers `isOwner`, `isAdmin` (=owner||admin), `isMember`.
- Carregar memberships após login via select em `workspace_members` + `workspaces`.

### Hook central `usePermissions()`
Retorna: `canViewContent`, `canEditContent`, `canInviteAdmin`, `canInviteMember`, `canRemoveMember(targetRole)`, `canChangeRoles`, `canRevokeInvite(invite)`, `canManageMembers`. Substitui todos os `isAdmin` espalhados.

### Telas
- **LoginPage**: mantém login/cadastro individuais. Remover redirect para `/welcome` com código. No cadastro, NÃO cria workspace automaticamente; redireciona para nova tela "Onboarding" com duas opções:
  - **Criar workspace** (input nome → chama `create_workspace`).
  - **Entrar com código de convite** (input código → chama `accept_workspace_invite`).
- **WelcomePage**: removida (não há mais código de admin para mostrar).
- **AppLayout**: remover botão/popover de "Código admin"; remover chip "Visualizador/Admin" baseado em código; adicionar **seletor de workspace** quando o usuário tem >1 membership.
- **MembersPage** (substitui/complementa `PeoplePage` para gestão real):
  - Lista membros com nome (do `profiles`), email (de `auth.users` via view ou RPC), role, status, data.
  - Owner: botões "Convidar admin", "Convidar member", promover/rebaixar, remover.
  - Admin: botão "Convidar member", remover member.
  - Member: somente leitura, sem botões.
- **InvitesPage** (ou aba): lista convites com cargo, criado por, expiração, status; botão revogar conforme permissão. Modal de geração mostra o código uma única vez + copiar.
- **Modal "Entrar em workspace"**: acessível dentro do app e na tela de onboarding pós-signup.
- **Rotas protegidas**: criar `<RequireRole roles={['owner','admin']}>` para `/gamification-admin` etc.; rota sem permissão mostra "Você não tem permissão para acessar esta área."

### Limpeza
- Remover toda leitura de role/admin do `localStorage` (manter apenas `activeWorkspaceId`).
- Remover chamadas `redeem_access_code`/`demote_self_to_viewer`.
- Auditar usos de `isAdmin` → trocar por `usePermissions().canEditContent` (escrita) ou `.canManageMembers` (administração de pessoas).

## 3. Segurança extra
- Habilitar **Leaked Password Protection** (HIBP) no Supabase Auth.
- Mensagens de erro genéricas em `accept_workspace_invite` (não revelar se workspace existe).
- Convite admin: padrão 1h e 1 uso, forçado server-side independente do que o front enviar.
- Logs gravados em todas as RPCs sensíveis.

## 4. Migração de dados existentes
- Workspaces atuais: `workspaces.user_id` → membership `owner`. Demais `admin` ficam `admin`, `viewer` vira `member`.
- `access_code` deixa de ser usado (coluna mantida nullable para não quebrar tipos até a próxima limpeza).
- Convites antigos baseados em e-mail (`workspace_invites` atual) ficam ignorados/arquivados; nova tabela tem nome diferente ou recriamos com schema novo (decisão: **dropar e recriar** a tabela atual já que não há fluxo de e-mail em uso).

## 5. Critérios de aceite (testáveis)
Os 10 cenários descritos no pedido (criação de workspace, convite member, convite admin, tentativas de burla por admin/member via devtools, convite usado/expirado/revogado, multi-workspace, persistência pós-refresh) — todos validados tanto no front quanto via RLS/RPC.

## Detalhes técnicos relevantes
- Hash de código: `pgcrypto` (`crypt` + `gen_salt('bf')`).
- Geração de código: função SQL retornando `EMPRESA-XXXXX` com 5 chars de `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`.
- `is_workspace_admin` reescrita: `role IN ('owner','admin')` no workspace ativo.
- Todas as policies de escrita passam a usar `is_workspace_admin(auth.uid())` (já cobre owner+admin) — basicamente só precisamos atualizar a função.
- `get_workspace_id` continua existindo mas o app passará a respeitar `activeWorkspaceId` quando houver múltiplas memberships (policies precisarão evoluir para multi-workspace numa fase futura; nesta entrega seguimos com workspace único ativo, garantindo isolamento via membership).

## Fora de escopo desta entrega
- Transferência de propriedade (deixar RPC stub para futuro).
- Histórico de logs visível na UI (tabela criada, viewer pode vir depois).
- Multi-workspace seletor avançado (entregamos seletor simples; RLS continua via `get_workspace_id`).
