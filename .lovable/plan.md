
## ⚠️ Bloqueio sobre o Supabase externo

Você escolheu "usar o Supabase externo". **Eu não consigo fazer isso neste projeto.** O BuzzUp tem o Lovable Cloud ativo, e uma vez que o Cloud foi adicionado a um projeto, ele não pode ser desconectado nem substituído por um Supabase externo — nem voltando a versões anteriores. As keys que você colou (`sb_publishable_...` e principalmente `sb_secret_...`) **não serão usadas** e recomendo fortemente que você rotacione a `sb_secret` no painel do Supabase agora, pois ela dá acesso administrativo total ao banco.

**Duas saídas possíveis:**

- **A) Seguir no Lovable Cloud atual** — apago todas as tabelas e refaço o fluxo conforme você descreveu. É o que este plano abaixo executa.
- **B) Usar mesmo aquele Supabase externo** — você precisa criar um **novo projeto Lovable sem Cloud** e me chamar lá; eu não consigo migrar este.

**O plano abaixo assume a opção A.** Se você quer B, me responda "quero B" em vez de aprovar.

---

## O que vai mudar

### Fluxo novo
1. **Landing** com um botão único "Começar".
2. Após clicar: tela com dois botões — "Criar conta pessoal" / "Já tenho conta".
3. Cadastro pede apenas: **nome pessoal, email pessoal, senha**.
4. Login leva direto ao **Hub Pessoal** (não mais ao dashboard de um workspace específico).
5. **Hub Pessoal** tem 4 abas:
   - **Workspaces ativos** — onde a pessoa já é membro. Clique entra naquele workspace.
   - **Workspaces criados** — subset dos ativos onde a pessoa é owner.
   - **Entrar em workspace** — campo para digitar código → cria pedido pendente.
   - **Convites enviados** — pedidos que a pessoa fez, em amarelo enquanto pendentes, somem/viram verde ao serem aprovados (realtime).
6. **Criar workspace**: pede só o nome. Sistema gera um código permanente (`BUZZ-XXXXXX`) exibido com botão de copiar; esse código serve para qualquer pessoa pedir entrada.
7. **Pedir entrada**: pessoa digita código → cria `join_request` pendente → owner vê na própria UI do workspace + recebe contagem no Hub. Owner aprova escolhendo o cargo (admin/member) ou rejeita.
8. **Realtime**: ao aprovar, o workspace aparece automaticamente nos "ativos" do solicitante sem refresh.
9. Dentro de um workspace, mantém-se tudo (dashboard, calendário, pessoas, projetos, áreas, etc.). Adiciono um **seletor de workspace** no header para trocar entre workspaces sem voltar ao hub.

### Mudanças de banco (apaga tudo e recria a parte de auth/workspaces)
- **Drop**: `workspace_invites`, `workspace_members`, `workspaces`, `profiles`, `activity_logs`, e todas as tabelas de conteúdo (`posts`, `tasks`, `people`, `teams`, `team_members`, `task_assignees`, `post_assignees`, `projects`, `project_participants`, `categories`, `channels`, `event_types`, `calendar_items`, `area_notes`, `parking_items`, `lead_thermometer`, `attendance_records`, `attendance_settings`, `broadcasts`, `gamification_actions`, `gamification_awards`). Banco zerado.
- **Recria**:
  - `profiles(user_id, display_name, email)` com trigger `handle_new_user`.
  - `workspaces(id, name, code UNIQUE, owner_user_id, created_at)` — código permanente armazenado em claro (não é segredo, é como um username público).
  - `workspace_members(workspace_id, user_id, role owner|admin|member, created_at)`.
  - `workspace_join_requests(id, workspace_id, user_id, status pending|approved|rejected, requested_at, decided_at, decided_by)`.
  - Recria todas as tabelas de conteúdo com a mesma estrutura atual, mas com `workspace_id` referenciando o novo `workspaces.id`.
- **RLS multi-workspace**: substitui `get_workspace_id(uid)` (que pega o mais antigo) por `is_member_of(uid, ws_id)` usado em todas as policies. Conteúdo passa a ser visível a qualquer workspace onde o user é membro.
- **RPCs** (SECURITY DEFINER):
  - `create_workspace(_name)` → cria ws + code + member owner.
  - `request_join_workspace(_code)` → cria join_request pendente.
  - `approve_join_request(_req_id, _role)` → só owner; vira member.
  - `reject_join_request(_req_id)` → só owner.
  - `cancel_join_request(_req_id)` → só o próprio solicitante.
  - `list_my_workspaces()`, `list_my_join_requests()`, `list_workspace_join_requests(_ws_id)`.
- **Realtime** habilitado em `workspace_members` e `workspace_join_requests`.

### Mudanças no frontend
- **Apaga**: `LoginPage.tsx` (refeito), `WelcomePage.tsx` (substituído pelo Hub), `MembersPage.tsx` (refeito), `ResetPasswordPage.tsx` (mantido), `GuidePage.tsx` (mantido), `AuthContext.tsx` (reescrito para multi-workspace + `activeWorkspaceId` no localStorage).
- **Cria**:
  - `LandingPage.tsx` — botão "Começar".
  - `AuthChoicePage.tsx` — escolhe criar conta / já tenho conta.
  - `SignUpPage.tsx`, `SignInPage.tsx` — separados.
  - `HubPage.tsx` — 4 abas (Ativos, Criados, Entrar, Enviados) com realtime.
  - `CreateWorkspaceDialog.tsx` — só nome → mostra código copiável.
  - `WorkspaceSwitcher.tsx` — no header do AppLayout.
  - `JoinRequestsPanel.tsx` — visível na MembersPage do owner.
- **Ajusta**: `ProtectedRoute` agora redireciona para `/hub` se não houver `activeWorkspaceId` selecionado. `DataContext` lê `activeWorkspaceId` do AuthContext em vez de assumir único workspace.

## Detalhes técnicos

- Código do workspace: 6 chars `BUZZ-XXXXXX` (alfanum sem caracteres ambíguos), único, gerado por `generate_workspace_code()`, regerável só pelo owner via RPC.
- `activeWorkspaceId` salvo em `localStorage` (não é credencial, só preferência de UI); toda query/RPC valida no backend que o user é membro do ws.
- Pedido duplicado pendente é bloqueado por unique parcial `(workspace_id, user_id) WHERE status='pending'`.
- Pedido para workspace onde já é membro retorna erro `already_member`.
- Realtime: o Hub assina mudanças em `workspace_join_requests WHERE user_id=auth.uid()` e em `workspace_members WHERE user_id=auth.uid()`. A MembersPage do owner assina `workspace_join_requests WHERE workspace_id=ws`.
- Cor amarela do pendente vem dos tokens semânticos existentes (`--warning` ou criado se faltar).

## Lacunas que ainda preciso confirmar

1. **Senha do owner para aprovar**: você quer alguma confirmação extra antes do owner aprovar/rejeitar (ex: dialog "Tem certeza?"), ou clique único basta?
2. **Notificação ao owner**: o owner deve ver um badge no menu lateral indicando pedidos pendentes? (vou implementar sim a menos que diga não)
3. **Email do solicitante visível para o owner**: ao aprovar, owner vê **nome + email** do solicitante, ou só o nome? Recomendo nome + email para o owner saber quem está aprovando.
4. **Owner sair do próprio workspace**: permito? Hoje não permite. Mantenho bloqueado a menos que você queira transferência de owner.
5. **Apagar dados existentes**: você confirma que pode apagar **TODOS** os posts, tasks, people, calendar, etc. que já estão no banco? Isso é destrutivo e irreversível.

Responda às 5 lacunas (ou diga "padrão" para aceitar minhas recomendações) e me confirme **A ou B** sobre o Supabase. Depois eu executo.
