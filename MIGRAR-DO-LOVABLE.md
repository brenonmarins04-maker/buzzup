# Como sair do Lovable Cloud sem perder nada

Seu site tem 2 partes: **frontend** (já é seu, no GitHub/Vercel) e **banco de dados**
(Supabase criado pelo Lovable). Só o banco depende do Lovable. Aqui está como migrá-lo
para uma conta Supabase **sua** sem perder dados nem trocar workspaces.

---

## Passo 1 — Criar projeto Supabase próprio (5 min, grátis)

1. Abra https://supabase.com → "Start your project"
2. Login com sua conta Google ou GitHub
3. "New project":
   - Name: `buzzup`
   - Database password: gere uma forte e salve num gerenciador
   - Region: `South America (São Paulo)`
   - Plan: **Free** (500MB, sobra muito)
4. Espere ~2 min terminar de provisionar

---

## Passo 2 — Pegar credenciais do projeto NOVO

No painel do projeto novo: **Settings → API**

Anote estes três valores:
- `Project URL` (ex: `https://xxxxxxxxxxxxx.supabase.co`)
- `Project ID` (a parte `xxxxxxxxxxxxx` antes de `.supabase.co`)
- `anon public` (a chave longa)

---

## Passo 3 — Replicar o schema no projeto NOVO

1. No projeto novo, abra **SQL Editor → New query**
2. Preciso te enviar o SQL completo do schema. Me peça:
   > "Me mande o SQL para criar todas as tabelas do BuzzUp"

   Eu gero o arquivo `schema.sql` com:
   - Todas as tabelas (workspaces, people, parking_items, etc.)
   - Triggers, functions, RLS policies
   - As funções RPC (`list_my_workspaces`, `approve_join_request`, etc.)
3. Cole no SQL Editor e rode

> Não dá pra fazer isso só com o `anon key` que temos — precisa rodar SQL como dono,
> e isso só funciona no projeto onde você é dono.

---

## Passo 4 — Copiar os DADOS do Supabase antigo

Tem 3 caminhos, escolha o mais fácil pra você:

### Caminho A — Pelo Lovable (mais fácil)
1. Acesse https://lovable.dev → seu projeto buzzup0
2. Procure botão "Database" ou "Backend" → "Export data"
3. Baixa um SQL dump completo
4. No Supabase NOVO: SQL Editor → cole e rode

### Caminho B — Pedir acesso ao projeto antigo (se conseguir)
1. Se alguém da equipe Lovable conseguir te adicionar como "Owner" em
   `ehuqbfbwgckusheiawsz`, vai aparecer em https://supabase.com/dashboard
2. Aí: **Settings → Database → Database backups → Download backup**
3. Restaura no projeto novo

### Caminho C — Script de cópia via API (sempre funciona)
1. Com a `anon key` antiga + os RLS policies que já existem, posso te escrever
   um script Node.js que:
   - Logga como você (admin do seu workspace)
   - Lê todas as tabelas do antigo
   - Escreve no novo
2. Me peça: "Faz o script de migração via API"

> Caminho A é o mais limpo. Tente esse primeiro.

---

## Passo 5 — Trocar as credenciais do site

No GitHub, edite o arquivo `.env` na raiz do repositório:

```env
VITE_SUPABASE_URL="https://SEU-PROJETO-NOVO.supabase.co"
VITE_SUPABASE_PROJECT_ID="SEU-PROJETO-NOVO"
VITE_SUPABASE_PUBLISHABLE_KEY="A-NOVA-ANON-KEY"
```

Faça o commit + push. O Vercel re-publica em ~2 min.

**Atenção:** o Vercel também precisa das variáveis de ambiente:
1. https://vercel.com/dashboard → projeto buzzup0
2. Settings → Environment Variables
3. Atualize as três variáveis com os valores novos
4. Redeploy

---

## Passo 6 — Verificar e arquivar o antigo

1. Faça login no site com seu usuário
2. Confira: workspaces, demandas, gamificação, presenças, times — tudo lá ✅
3. Só depois de confirmar 100%, pode parar de usar o Lovable

---

## O que NÃO muda

| Coisa | Status após migração |
|---|---|
| Workspaces existentes | ✅ Mantidos com mesmos códigos |
| Demandas no Quadro CB | ✅ Mantidas |
| Pontos de gamificação | ✅ Mantidos |
| Presenças marcadas | ✅ Mantidas |
| Times e membros | ✅ Mantidos |
| Apelidos | ✅ Mantidos |
| Acessos dos usuários | ✅ Mantidos (mesmos emails, mesmas senhas) |
| URL do site | ✅ Mesma (https://buzzup0.vercel.app) |
| Histórico do GitHub | ✅ Mesmo |
| Nome dos cargos (Diretor, Assessor) | ✅ Mantidos |

---

## Custo

- Supabase Free: 500MB storage, 2GB transfer/mês, 50.000 monthly active users
- Para um workspace pequeno (50-100 pessoas) você usa ~5MB. Sobra muito.
- Vercel já é seu, mesmo plano de antes.

**Custo da migração: R$ 0,00**

---

## Quando estiver pronto pra começar

Me peça em ordem:

1. `"Me mande o SQL para criar todas as tabelas do BuzzUp"`
2. (Depois de rodar) `"Me ajuda a copiar os dados — caminho X"`
3. (Por fim) `"Atualiza o .env e os env do Vercel"`

Não rode nada antes de eu te mandar o SQL — você precisa ter o schema correto no
projeto novo ANTES de tentar copiar os dados.
