/**
 * migrate-data.mjs — Migração segura do Supabase ANTIGO → NOVO
 *
 * Uso:
 *   node migrate-data.mjs <NEW_URL> <NEW_SERVICE_ROLE_KEY> [OLD_SERVICE_ROLE_KEY]
 *
 * Onde pegar:
 *   NEW_URL              = Supabase novo → Settings → API → Project URL
 *   NEW_SERVICE_ROLE_KEY = Supabase novo → Settings → API → service_role (secret)
 *   OLD_SERVICE_ROLE_KEY = Supabase antigo (Lovable) → se conseguir, opcional
 *
 * Exemplo:
 *   node migrate-data.mjs https://abc.supabase.co eyJservice... eyJservice_old...
 *
 * IMPORTANTE: Node.js 18+. Instale dependência antes:
 *   npm install @supabase/supabase-js
 */

import { createClient } from "@supabase/supabase-js";

// ── Banco ANTIGO (Lovable) ─────────────────────────────────────────
const OLD_URL  = "https://ehuqbfbwgckusheiawsz.supabase.co";
const OLD_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVodXFiZmJ3Z2NrdXNoZWlhd3N6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwOTU5NzcsImV4cCI6MjA5MTY3MTk3N30.MUr3EPeKyJf1BT6_E2PpXcxWXZC8CalhK9FpCTeQXUs";

// ── Parâmetros ─────────────────────────────────────────────────────
const NEW_URL         = process.argv[2];
const NEW_SERVICE_KEY = process.argv[3];
const OLD_SERVICE_KEY = process.argv[4]; // opcional

if (!NEW_URL || !NEW_SERVICE_KEY) {
  console.error("❌  Uso: node migrate-data.mjs <NEW_URL> <NEW_SERVICE_ROLE_KEY> [OLD_SERVICE_ROLE_KEY]");
  console.error("\nOnde pegar NEW_SERVICE_ROLE_KEY:");
  console.error("  Supabase novo → Settings → API → service_role (secret) ← NÃO é a anon key!");
  process.exit(1);
}

// service_role bypassa RLS completamente — essencial para leitura/escrita sem auth
const OLD = createClient(OLD_URL, OLD_SERVICE_KEY || OLD_ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const NEW = createClient(NEW_URL, NEW_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── Configuração de cada tabela ────────────────────────────────────
// conflictCol: coluna usada para upsert (evita duplicatas ao re-rodar)
// skip: tabelas que o Supabase gerencia automaticamente (auth.users não é copiável assim)
const TABLES = [
  // Tabelas raiz
  { name: "workspaces",                conflictCol: "id" },
  { name: "profiles",                  conflictCol: "user_id" },  // PK é user_id, não id!
  { name: "workspace_members",         conflictCol: "id" },
  { name: "workspace_join_requests",   conflictCol: "id" },
  // Dados operacionais
  { name: "people",                    conflictCol: "id" },
  { name: "teams",                     conflictCol: "id" },
  { name: "team_members",              conflictCol: "id" },
  { name: "projects",                  conflictCol: "id" },
  { name: "project_participants",      conflictCol: "id" },
  { name: "tasks",                     conflictCol: "id" },
  { name: "task_assignees",            conflictCol: "id" },
  { name: "posts",                     conflictCol: "id" },
  { name: "post_assignees",            conflictCol: "id" },
  { name: "calendar_items",            conflictCol: "id" },
  { name: "categories",               conflictCol: "id" },
  { name: "channels",                  conflictCol: "id" },
  { name: "event_types",               conflictCol: "id" },
  { name: "area_notes",               conflictCol: "id" },
  { name: "parking_items",             conflictCol: "id" },
  { name: "gamification_actions",      conflictCol: "id" },
  { name: "gamification_awards",       conflictCol: "id" },
  { name: "lead_thermometer",          conflictCol: "id" },
  { name: "attendance_settings",       conflictCol: "id" },
  { name: "attendance_records",        conflictCol: "id" },
  { name: "broadcasts",               conflictCol: "id" },
];

const PAGE_SIZE = 500;
const BATCH_SIZE = 100;

// ── Helpers ────────────────────────────────────────────────────────
async function fetchAllRows(client, tableName) {
  const rows = [];
  let from = 0;
  while (true) {
    const { data, error } = await client
      .from(tableName)
      .select("*")
      .range(from, from + PAGE_SIZE - 1)
      .order("created_at", { ascending: true })
      .limit(PAGE_SIZE);

    if (error) {
      // Tenta sem order se a tabela não tem created_at
      const { data: data2, error: e2 } = await client
        .from(tableName)
        .select("*")
        .range(from, from + PAGE_SIZE - 1)
        .limit(PAGE_SIZE);
      if (e2) throw new Error(e2.message);
      if (!data2 || data2.length === 0) break;
      rows.push(...data2);
      from += data2.length;
      if (data2.length < PAGE_SIZE) break;
      continue;
    }

    if (!data || data.length === 0) break;
    rows.push(...data);
    from += data.length;
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

async function upsertRows(client, tableName, conflictCol, rows) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const { error } = await client
      .from(tableName)
      .upsert(chunk, { onConflict: conflictCol, ignoreDuplicates: false });
    if (error) {
      throw new Error(`lote ${i}–${i + chunk.length}: ${error.message}`);
    }
  }
}

function fmt(n) { return String(n).padStart(5); }

// ── Verificação pós-migração ───────────────────────────────────────
async function verify(tableName) {
  const [{ count: oldCount }, { count: newCount }] = await Promise.all([
    OLD.from(tableName).select("*", { count: "exact", head: true }),
    NEW.from(tableName).select("*", { count: "exact", head: true }),
  ]);
  return { old: oldCount ?? 0, new: newCount ?? 0 };
}

// ── Main ───────────────────────────────────────────────────────────
async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║       BuzzUp — Migração de dados Supabase        ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  if (!OLD_SERVICE_KEY) {
    console.warn("⚠️  Sem service_role do banco ANTIGO — usando anon key.");
    console.warn("   Tabelas protegidas por RLS podem retornar 0 linhas.\n");
  }

  console.log("FASE 1 — Copiando dados...\n");

  const results = [];

  for (const { name, conflictCol } of TABLES) {
    process.stdout.write(`  ${name.padEnd(32)}`);
    let status = "ok";
    let count = 0;

    try {
      const rows = await fetchAllRows(OLD, name);
      count = rows.length;

      if (rows.length === 0) {
        process.stdout.write("(vazio)\n");
        results.push({ name, count: 0, status: "empty" });
        continue;
      }

      await upsertRows(NEW, name, conflictCol, rows);
      process.stdout.write(`✅  ${fmt(rows.length)} registros\n`);
      status = "ok";
    } catch (err) {
      process.stdout.write(`❌  ${err.message.slice(0, 80)}\n`);
      status = "error";
    }

    results.push({ name, count, status });
  }

  // ── Fase 2: verificação ──────────────────────────────────────────
  console.log("\nFASE 2 — Verificando contagens (antigo vs novo)...\n");

  let allMatch = true;
  for (const { name, status } of results) {
    if (status === "error") continue;
    try {
      const { old: o, new: n } = await verify(name);
      const match = o === n;
      if (!match) allMatch = false;
      const icon = match ? "✅" : "⚠️ ";
      const diff = match ? "" : `  ← DIFERENÇA: antigo=${o} novo=${n}`;
      console.log(`  ${icon} ${name.padEnd(32)} ${fmt(o)} → ${fmt(n)}${diff}`);
    } catch {
      console.log(`  ⚠️  ${name.padEnd(32)} não foi possível verificar`);
    }
  }

  // ── Resumo ───────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════");
  if (allMatch) {
    console.log("✅  MIGRAÇÃO COMPLETA — todos os dados batem!");
  } else {
    console.log("⚠️  Algumas tabelas têm diferença de contagem.");
    console.log("   Verifique acima quais tabelas precisam atenção.");
    console.log("   Possível causa: RLS bloqueou leitura do banco antigo.");
    console.log("   Solução: obtenha a service_role key do banco antigo e re-rode.");
  }
  console.log("\n📋  PRÓXIMO PASSO:");
  console.log("   1. Abra o arquivo .env e substitua as credenciais pelo banco NOVO");
  console.log("   2. Faça git add .env && git commit && git push");
  console.log("   3. No Vercel: Settings → Environment Variables → atualize as 3 vars");
  console.log("   4. Redeploy no Vercel");
  console.log("══════════════════════════════════════════════════\n");
}

main().catch(err => {
  console.error("\n❌  Erro fatal:", err.message);
  process.exit(1);
});
