/**
 * importar-backup.mjs — Importa o buzzup-backup.json para o banco NOVO
 *
 * Uso:
 *   node importar-backup.mjs <CAMINHO_DO_JSON>
 *
 * Exemplo:
 *   node importar-backup.mjs "C:\Users\breno\Downloads\buzzup-backup.json"
 *
 * As credenciais do banco novo já estão fixas abaixo.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const NEW_URL         = "https://twwcnudhfvzbkdrtfmtu.supabase.co";
// service_role passada via variável de ambiente para não ficar no código
const NEW_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!NEW_SERVICE_KEY) {
  console.error("\n❌  Defina a variável de ambiente SUPABASE_SERVICE_KEY antes de rodar:");
  console.error('   $env:SUPABASE_SERVICE_KEY="eyJhbGci..."   (PowerShell)');
  console.error('   set SUPABASE_SERVICE_KEY=eyJhbGci...      (CMD)\n');
  process.exit(1);
}

const JSON_PATH = process.argv[2];
if (!JSON_PATH) {
  console.error('\n❌  Uso: node importar-backup.mjs "caminho\\buzzup-backup.json"\n');
  process.exit(1);
}

const NEW = createClient(NEW_URL, NEW_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Ordem respeita FK
const TABLE_ORDER = [
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

function pad(s, n = 32) { return String(s).padEnd(n); }
function padL(s, n = 6)  { return String(s).padStart(n); }

async function upsertRows(table, pk, rows) {
  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await NEW.from(table).upsert(chunk, {
      onConflict: pk,
      ignoreDuplicates: false,
    });
    if (error) throw new Error(`lote ${i}: ${error.message}`);
  }
}

async function main() {
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║        BuzzUp — Importar backup para banco NOVO  ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  // Lê o JSON
  let backup;
  try {
    const raw = readFileSync(JSON_PATH, "utf-8");
    backup = JSON.parse(raw);
    console.log(`📁  Arquivo: ${JSON_PATH}`);
    const total = Object.values(backup).reduce((s, r) => s + r.length, 0);
    console.log(`    Total de registros no backup: ${total}\n`);
  } catch (err) {
    console.error(`❌  Erro ao ler arquivo: ${err.message}`);
    process.exit(1);
  }

  console.log("FASE 1 — Importando...\n");
  let totalCopied = 0;
  const errors = [];

  for (const { name, pk } of TABLE_ORDER) {
    const rows = backup[name] || [];
    process.stdout.write(`  ${pad(name)}`);
    if (rows.length === 0) {
      process.stdout.write("(vazio)\n");
      continue;
    }
    try {
      await upsertRows(name, pk, rows);
      totalCopied += rows.length;
      process.stdout.write(`✅  ${padL(rows.length)} registros\n`);
    } catch (err) {
      process.stdout.write(`❌  ${err.message.slice(0, 80)}\n`);
      errors.push({ name, err: err.message });
    }
  }

  console.log("\nFASE 2 — Verificando contagens...\n");
  let allOk = true;

  for (const { name } of TABLE_ORDER) {
    const backupCount = (backup[name] || []).length;
    const { count } = await NEW.from(name).select("*", { count: "exact", head: true });
    const newCount = count ?? 0;
    const match = backupCount === newCount;
    if (!match) allOk = false;
    const icon = match ? "✅" : "⚠️ ";
    const diff = match ? "" : `  ← DIFERENÇA backup=${backupCount} banco=${newCount}`;
    console.log(`  ${icon} ${pad(name)} ${padL(backupCount)} → ${padL(newCount)}${diff}`);
  }

  console.log("\n══════════════════════════════════════════════════");
  if (allOk && errors.length === 0) {
    console.log(`✅  IMPORTAÇÃO COMPLETA! ${totalCopied} registros copiados.\n`);
    console.log("📋  PRÓXIMO PASSO — atualize as credenciais do site:");
    console.log("\n   1. Abra o arquivo .env e substitua:");
    console.log("      VITE_SUPABASE_URL=https://twwcnudhfvzbkdrtfmtu.supabase.co");
    console.log("      VITE_SUPABASE_PROJECT_ID=twwcnudhfvzbkdrtfmtu");
    console.log("      VITE_SUPABASE_PUBLISHABLE_KEY=<anon key do banco novo>");
    console.log("\n   2. git add .env && git commit -m 'chore: usa banco proprio' && git push");
    console.log("   3. Vercel → Settings → Environment Variables → atualize as 3 vars → Redeploy");
  } else {
    if (errors.length > 0) console.log(`⚠️  Tabelas com erro: ${errors.map(e => e.name).join(", ")}`);
    if (!allOk) { console.log("⚠️  Diferenças encontradas. Rode novamente (é seguro)."); }
  }
  console.log("══════════════════════════════════════════════════\n");
}

main().catch(err => {
  console.error("\n❌  Erro fatal:", err.message);
  process.exit(1);
});
