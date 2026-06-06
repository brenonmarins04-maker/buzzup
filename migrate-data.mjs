/**
 * migrate-data.mjs — Migração segura do Supabase ANTIGO → NOVO
 *
 * Uso:
 *   node migrate-data.mjs <EMAIL> <SENHA> <NEW_SERVICE_ROLE_KEY>
 *
 * Exemplo:
 *   node migrate-data.mjs meu@email.com minhasenha123 eyJservice...
 *
 * EMAIL / SENHA = seu login do BuzzUp (conta que é owner do workspace)
 * NEW_SERVICE_ROLE_KEY = Supabase NOVO → Settings → API → service_role
 *
 * IMPORTANTE: Node.js 18+
 */

import { createClient } from "@supabase/supabase-js";

// ── Banco ANTIGO (Lovable) ─────────────────────────────────────────
const OLD_URL  = "https://ehuqbfbwgckusheiawsz.supabase.co";
const OLD_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVodXFiZmJ3Z2NrdXNoZWlhd3N6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwOTU5NzcsImV4cCI6MjA5MTY3MTk3N30.MUr3EPeKyJf1BT6_E2PpXcxWXZC8CalhK9FpCTeQXUs";

// ── Banco NOVO (seu) — passado via args, nunca hardcoded ───────────
const NEW_URL         = process.argv[2]; // https://twwcnudhfvzbkdrtfmtu.supabase.co
const NEW_SERVICE_KEY = process.argv[3]; // service_role key do banco novo
const EMAIL           = process.argv[4]; // seu email do BuzzUp
const SENHA           = process.argv[5]; // sua senha do BuzzUp

if (!NEW_URL || !NEW_SERVICE_KEY || !EMAIL || !SENHA) {
  console.error("\n❌  Uso: node migrate-data.mjs <NEW_URL> <NEW_SERVICE_KEY> <EMAIL> <SENHA>");
  console.error("\n   NEW_URL        = https://twwcnudhfvzbkdrtfmtu.supabase.co");
  console.error("   NEW_SERVICE_KEY = Settings → API → service_role (banco novo)");
  console.error("   EMAIL/SENHA     = seu login do BuzzUp\n");
  process.exit(1);
}

// Cliente antigo — começa anon, vira autenticado após login
const OLD = createClient(OLD_URL, OLD_ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Cliente novo — usa service_role, bypassa RLS completamente
const NEW = createClient(NEW_URL, NEW_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── Ordem de cópia (respeita chaves estrangeiras) ──────────────────
const TABLES = [
  { name: "workspaces",              pk: "id" },
  { name: "profiles",                pk: "user_id" },
  { name: "workspace_members",       pk: "id" },
  { name: "workspace_join_requests", pk: "id" },
  { name: "people",                  pk: "id" },
  { name: "teams",                   pk: "id" },
  { name: "team_members",            pk: "id" },
  { name: "projects",               pk: "id" },
  { name: "project_participants",    pk: "id" },
  { name: "tasks",                   pk: "id" },
  { name: "task_assignees",          pk: "id" },
  { name: "posts",                   pk: "id" },
  { name: "post_assignees",          pk: "id" },
  { name: "calendar_items",          pk: "id" },
  { name: "categories",             pk: "id" },
  { name: "channels",               pk: "id" },
  { name: "event_types",            pk: "id" },
  { name: "area_notes",             pk: "id" },
  { name: "parking_items",          pk: "id" },
  { name: "gamification_actions",   pk: "id" },
  { name: "gamification_awards",    pk: "id" },
  { name: "lead_thermometer",       pk: "id" },
  { name: "attendance_settings",    pk: "id" },
  { name: "attendance_records",     pk: "id" },
  { name: "broadcasts",             pk: "id" },
];

// ── Helpers ────────────────────────────────────────────────────────
async function fetchAllRows(client, tableName) {
  const rows = [];
  let from = 0;
  const PAGE = 500;
  while (true) {
    // Tenta com order por created_at (maioria tem)
    let res = await client.from(tableName).select("*").range(from, from + PAGE - 1);
    if (res.error) {
      // Tenta sem ordering
      res = await client.from(tableName).select("*").range(from, from + PAGE - 1);
      if (res.error) throw new Error(res.error.message);
    }
    const data = res.data || [];
    rows.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

async function upsertRows(client, tableName, pk, rows) {
  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await client
      .from(tableName)
      .upsert(chunk, { onConflict: pk, ignoreDuplicates: false });
    if (error) throw new Error(`lote ${i}: ${error.message}`);
  }
}

async function countRows(client, tableName) {
  const { count, error } = await client
    .from(tableName)
    .select("*", { count: "exact", head: true });
  if (error) return "?";
  return count ?? 0;
}

function pad(s, n = 32) { return String(s).padEnd(n); }
function padL(s, n = 6) { return String(s).padStart(n); }

// ── Main ───────────────────────────────────────────────────────────
async function main() {
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║       BuzzUp — Migração de dados Supabase        ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  // 1. Autenticar no banco ANTIGO
  console.log(`🔐  Fazendo login no banco antigo como ${EMAIL}...`);
  const { data: authData, error: authErr } = await OLD.auth.signInWithPassword({
    email: EMAIL,
    password: SENHA,
  });
  if (authErr) {
    console.error(`\n❌  Login falhou: ${authErr.message}`);
    console.error("   Verifique email e senha. São os mesmos que você usa no BuzzUp.");
    process.exit(1);
  }
  console.log(`✅  Logado como ${authData.user?.email}\n`);

  // 2. Copiar tabelas
  console.log("FASE 1 — Copiando dados...\n");
  const results = [];

  for (const { name, pk } of TABLES) {
    process.stdout.write(`  ${pad(name)}`);
    try {
      const rows = await fetchAllRows(OLD, name);
      if (rows.length === 0) {
        process.stdout.write("(vazio)\n");
        results.push({ name, count: 0, status: "empty" });
        continue;
      }
      await upsertRows(NEW, name, pk, rows);
      process.stdout.write(`✅  ${padL(rows.length)} registros\n`);
      results.push({ name, count: rows.length, status: "ok" });
    } catch (err) {
      process.stdout.write(`❌  ${err.message.slice(0, 90)}\n`);
      results.push({ name, count: 0, status: "error", err: err.message });
    }
  }

  // 3. Verificação de contagens
  console.log("\nFASE 2 — Verificando contagens (antigo vs novo)...\n");
  let allOk = true;
  const erros = [];

  for (const { name, status } of results) {
    if (status === "error") { erros.push(name); continue; }
    const [oldCount, newCount] = await Promise.all([
      countRows(OLD, name),
      countRows(NEW, name),
    ]);
    const match = oldCount === newCount;
    if (!match) allOk = false;
    const icon = match ? "✅" : "⚠️ ";
    const diff = match ? "" : `  ← DIFERENÇA antigo=${oldCount} novo=${newCount}`;
    console.log(`  ${icon} ${pad(name)} ${padL(oldCount)} → ${padL(newCount)}${diff}`);
  }

  // 4. Resumo
  console.log("\n══════════════════════════════════════════════════");
  if (allOk && erros.length === 0) {
    console.log("✅  MIGRAÇÃO 100% COMPLETA — todos os dados foram copiados!");
  } else {
    if (erros.length > 0) {
      console.log(`⚠️  Tabelas com erro: ${erros.join(", ")}`);
    }
    if (!allOk) {
      console.log("⚠️  Algumas tabelas têm diferença de contagem.");
      console.log("   Rode o script novamente — ele é seguro para re-executar.");
    }
  }

  console.log(`
📋  PRÓXIMO PASSO:
   Agora atualize o arquivo .env com o banco NOVO e faça push.
   Vou fazer isso automaticamente — me diga "atualiza o .env".
══════════════════════════════════════════════════
`);
}

main().catch(err => {
  console.error("\n❌  Erro fatal:", err.message);
  process.exit(1);
});
