
## Visão geral

Hoje cada workspace pertence a 1 usuário (`workspaces.user_id`) e a função `get_workspace_id` retorna o workspace que o próprio usuário criou. Para que outras pessoas possam ser convidadas e logar no MESMO workspace, precisamos:

1. Adicionar **cargo** (Administrador / Membro) e **email** em cada pessoa.
2. Criar uma tabela de **membros do workspace** (vínculo user ↔ workspace + role).
3. Criar uma tabela de **convites pendentes** + edge function que dispara o email.
4. Quando o convidado se cadastrar/logar com aquele email, ele é automaticamente vinculado ao workspace certo (com o cargo definido).
5. Atualizar a UI da aba Pessoas para mostrar o cargo abaixo do nome e ter campo de email + botão "Enviar convite".

---

## 1. Banco de dados (migração)

**Tabela `people`** — adicionar colunas:
- `email text` (default `''`)
- `role text` (default `'member'`, valores: `admin` | `member`)
- `user_id uuid` (nullable — preenchido quando a pessoa aceita o convite e cria conta)

**Nova tabela `workspace_members`**:
- `id`, `workspace_id`, `user_id`, `role` (`admin` | `member`), `created_at`
- UNIQUE (`workspace_id`, `user_id`)
- RLS: usuário vê seus próprios vínculos

**Nova tabela `workspace_invites`**:
- `id`, `workspace_id`, `email`, `role`, `token` (uuid), `invited_by` (uuid), `status` (`pending` | `accepted` | `expired`), `created_at`, `expires_at`
- RLS: somente membros do workspace podem ver/criar convites do próprio workspace

**Refatorar `get_workspace_id(_user_id)`**:
- Hoje: busca em `workspaces.user_id`.
- Novo: busca em `workspace_members.user_id` (retorna o workspace_id do qual o usuário faz parte). Mantém compatibilidade — o trigger `handle_new_user` continua criando o workspace inicial e agora também insere uma linha em `workspace_members` com role `admin` para o criador.

**Trigger `handle_new_user` atualizado**:
1. Cria profile.
2. Verifica se existe `workspace_invites` com `email = NEW.email` e `status = pending`:
   - Se sim → insere em `workspace_members` com o workspace e role do convite, marca convite como `accepted`, atualiza `people.user_id` correspondente.
   - Se não → cria novo workspace (comportamento atual) e insere `workspace_members` com role `admin`.

---

## 2. Email de convite (Lovable Cloud Email)

- Configurar **domínio de email** (necessário um clique no diálogo de setup).
- Configurar infra de email transacional.
- Criar template `workspace-invite.tsx` com botão "Aceitar convite" → link `https://<app>/login?invite=<token>`.
- Criar edge function `send-invite`:
  - Recebe `{ personId, email, role }`.
  - Valida que o usuário pertence ao workspace.
  - Cria/atualiza linha em `workspace_invites` (gera token).
  - Atualiza `people` (email + role).
  - Invoca `send-transactional-email` com template `workspace-invite`.

---

## 3. Fluxo de login do convidado

- LoginPage detecta `?invite=<token>` na URL e:
  - Se o email do token ainda não tem conta → mostra a tela de **cadastro** (email já preenchido, pede senha + confirmar senha).
  - Se já existe conta → mostra **login normal** (apenas senha).
- Após signup/login, o trigger `handle_new_user` (no signup) ou um RPC `accept_invite(token)` (no login de usuário existente) vincula em `workspace_members`.

---

## 4. UI

**`PeoplePage.tsx`** — modal de adicionar/editar pessoa:
- Campos: Nome, Email, Cargo (select Administrador/Membro).
- Botão extra "Salvar e enviar convite" → chama edge function `send-invite`.
- Card da pessoa: mostra **cargo em badge pequeno abaixo do nome** (ex.: "Administrador" em destaque, "Membro" em cinza). Se ainda for convite pendente, mostra "Convite enviado".

**`DataContext.tsx`** — estender `addPerson` / `updatePerson` para aceitar `email` e `role`; novo método `inviteperson(personId)`.

---

## Resumo técnico

```text
people (+email, +role, +user_id)
workspace_members (workspace_id, user_id, role)  ← nova fonte de verdade do RLS
workspace_invites (token, email, workspace_id, role, status)
get_workspace_id() → lê de workspace_members
handle_new_user() → aceita convite pendente OU cria workspace novo
edge fn send-invite → cria convite + dispara email
LoginPage → ?invite=token → signup com senha+confirmar OU login normal
```

Após sua aprovação eu:
1. Rodo a migração das tabelas/colunas/RLS/funções.
2. Configuro o domínio de email (vou pedir um clique no diálogo).
3. Crio o template + edge function de convite.
4. Atualizo PeoplePage, DataContext, LoginPage.
