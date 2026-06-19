/**
 * migrate-fix.mjs — corrige tabelas com FK user_id
 * Insere people (user_id=null), team_members, e tabelas que ficaram vazias
 * Uso: node migrate-fix.mjs
 */
import { spawnSync } from "child_process";

const OLD_HOST = "ehuqbfbwgckusheiawsz.supabase.co";
const OLD_IP   = "104.18.38.10";
const OLD_URL  = `https://${OLD_HOST}`;
const OLD_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVodXFiZmJ3Z2NrdXNoZWlhd3N6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwOTU5NzcsImV4cCI6MjA5MTY3MTk3N30.MUr3EPeKyJf1BT6_E2PpXcxWXZC8CalhK9FpCTeQXUs";
const OLD_RESOLVE = `${OLD_HOST}:443:${OLD_IP}`;

const NEW_HOST = "twwcnudhfvzbkdrtfmtu.supabase.co";
const NEW_IP   = "104.18.38.10";
const NEW_URL  = `https://${NEW_HOST}`;
const NEW_RESOLVE = `${NEW_HOST}:443:${NEW_IP}`;
const NEW_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3d2NudWRoZnZ6YmtkcnRmbXR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDc1OTIyOSwiZXhwIjoyMDk2MzM1MjI5fQ.hyCQ_0W3Na5Y2h4N8zGqDwW6tuoy31FBk3zXsDZI76w";

const OLD_EMAIL = "brenonmarins05@gmail.com";
const OLD_SENHA = "Bnm04102005_-";
const NEW_USER_ID = "cfe254b3-fcbe-48b9-bda6-cc3b48593dd4"; // criado anteriormente
const PROJEC_WS   = "28ccdca6-c176-45af-b4cc-50d2818575bf";

function curlOld(path, token) {
  const r = spawnSync("curl", [
    "-s", "--resolve", OLD_RESOLVE, "--max-time", "30",
    "-H", `apikey: ${OLD_ANON}`,
    "-H", `Authorization: Bearer ${token}`,
    "-H", "Accept: application/json",
    `${OLD_URL}${path}`,
  ], { encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 });
  if (r.error) throw new Error(r.error.message);
  const d = JSON.parse(r.stdout);
  if (d && d.error) throw new Error(d.error + ": " + (d.message || ""));
  return d;
}

function curlNew(table, rows) {
  const body = JSON.stringify(rows);
  const r = spawnSync("curl", [
    "-s", "--resolve", NEW_RESOLVE, "--max-time", "60",
    "-X", "POST",
    "-H", `apikey: ${NEW_KEY}`,
    "-H", `Authorization: Bearer ${NEW_KEY}`,
    "-H", "Content-Type: application/json",
    "-H", "Prefer: resolution=merge-duplicates,return=minimal",
    "-d", body,
    `${NEW_URL}/rest/v1/${table}`,
  ], { encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 });
  if (r.error) throw new Error(r.error.message);
  if (r.stdout && r.stdout.trim()) {
    try {
      const p = JSON.parse(r.stdout);
      if (p && (p.code || p.error)) throw new Error((p.message || p.error || "").slice(0, 150));
    } catch(e) { if (e.message.includes("curl") || e.message.includes("violates") || e.message.includes("PGRST")) throw e; }
  }
}

function curlNewCount(table) {
  const r = spawnSync("curl", [
    "-s", "--resolve", NEW_RESOLVE, "--max-time", "30",
    "-H", `apikey: ${NEW_KEY}`,
    "-H", `Authorization: Bearer ${NEW_KEY}`,
    `${NEW_URL}/rest/v1/${table}?select=id&limit=500`,
  ], { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
  if (r.error) return -1;
  try { return JSON.parse(r.stdout).length; } catch { return -1; }
}

function readAll(table, token) {
  const rows = [];
  const PAGE = 200;
  let from = 0;
  while (true) {
    const d = curlOld(`/rest/v1/${table}?select=*&limit=${PAGE}&offset=${from}`, token);
    if (!Array.isArray(d) || d.length === 0) break;
    rows.push(...d);
    if (d.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

function writeAll(table, rows, BATCH = 50) {
  for (let i = 0; i < rows.length; i += BATCH) {
    curlNew(table, rows.slice(i, i + BATCH));
  }
}

function login() {
  const r = spawnSync("curl", [
    "-s", "--resolve", OLD_RESOLVE, "--max-time", "20",
    "-X", "POST",
    "-H", `apikey: ${OLD_ANON}`,
    "-H", "Content-Type: application/json",
    "-d", JSON.stringify({ email: OLD_EMAIL, password: OLD_SENHA }),
    `${OLD_URL}/auth/v1/token?grant_type=password`,
  ], { encoding: "utf-8" });
  if (r.error) throw new Error(r.error.message);
  const d = JSON.parse(r.stdout);
  if (d.error) throw new Error(d.error_description || d.error);
  return d.access_token;
}

function pad(s) { return String(s).padEnd(28); }

async function main() {
  console.log("\n╔═══════════════════════════════════════════════╗");
  console.log("║  BuzzUp — Migração Complementar (fix user_id) ║");
  console.log("╚═══════════════════════════════════════════════╝\n");

  process.stdout.write("🔐 Login no Lovable... ");
  const token = login();
  console.log("✅");

  const results = [];

  // ── 1. People com user_id = null ──────────────────────────────────
  process.stdout.write(`${pad("people")} `);
  try {
    const rows = readAll("people", token).map(p => ({ ...p, user_id: null }));
    // delete rows that already exist (keep idempotent)
    writeAll("people", rows);
    const cnt = curlNewCount("people");
    process.stdout.write(`✅ ${rows.length} inseridos | ${cnt} no banco\n`);
    results.push({ name: "people", ok: true });
  } catch(e) { process.stdout.write(`❌ ${e.message.slice(0,80)}\n`); results.push({ name: "people", ok: false }); }

  // ── 2. team_members (sem user_id) ─────────────────────────────────
  process.stdout.write(`${pad("team_members")} `);
  try {
    const rows = readAll("team_members", token);
    writeAll("team_members", rows);
    const cnt = curlNewCount("team_members");
    process.stdout.write(`✅ ${rows.length} inseridos | ${cnt} no banco\n`);
    results.push({ name: "team_members", ok: true });
  } catch(e) { process.stdout.write(`❌ ${e.message.slice(0,80)}\n`); results.push({ name: "team_members", ok: false }); }

  // ── 3. parking_items (sem user_id) ────────────────────────────────
  process.stdout.write(`${pad("parking_items")} `);
  try {
    const rows = readAll("parking_items", token);
    writeAll("parking_items", rows);
    const cnt = curlNewCount("parking_items");
    process.stdout.write(`✅ ${rows.length} inseridos | ${cnt} no banco\n`);
    results.push({ name: "parking_items", ok: true });
  } catch(e) { process.stdout.write(`❌ ${e.message.slice(0,80)}\n`); results.push({ name: "parking_items", ok: false }); }

  // ── 4. gamification_awards ────────────────────────────────────────
  process.stdout.write(`${pad("gamification_awards")} `);
  try {
    const rows = readAll("gamification_awards", token);
    writeAll("gamification_awards", rows);
    const cnt = curlNewCount("gamification_awards");
    process.stdout.write(`✅ ${rows.length} inseridos | ${cnt} no banco\n`);
    results.push({ name: "gamification_awards", ok: true });
  } catch(e) { process.stdout.write(`❌ ${e.message.slice(0,80)}\n`); results.push({ name: "gamification_awards", ok: false }); }

  // ── 5. attendance_records ─────────────────────────────────────────
  process.stdout.write(`${pad("attendance_records")} `);
  try {
    const rows = readAll("attendance_records", token);
    writeAll("attendance_records", rows);
    const cnt = curlNewCount("attendance_records");
    process.stdout.write(`✅ ${rows.length} inseridos | ${cnt} no banco\n`);
    results.push({ name: "attendance_records", ok: true });
  } catch(e) { process.stdout.write(`❌ ${e.message.slice(0,80)}\n`); results.push({ name: "attendance_records", ok: false }); }

  // ── 6. workspace_join_requests (mapeia user_id para o novo) ───────
  process.stdout.write(`${pad("workspace_join_requests")} `);
  try {
    const oldUserId = "45f5c566-a6bb-421f-b215-d00db52c6aee";
    const rows = readAll("workspace_join_requests", token).map(r => ({
      ...r,
      user_id: r.user_id === oldUserId ? NEW_USER_ID : null,
    })).filter(r => r.user_id !== null); // só insere os do usuário principal
    if (rows.length > 0) {
      writeAll("workspace_join_requests", rows);
    }
    const cnt = curlNewCount("workspace_join_requests");
    process.stdout.write(`✅ ${rows.length} do usuario principal | ${cnt} no banco\n`);
    results.push({ name: "workspace_join_requests", ok: true });
  } catch(e) { process.stdout.write(`❌ ${e.message.slice(0,80)}\n`); results.push({ name: "workspace_join_requests", ok: false }); }

  // ── Resumo ────────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════");
  const falhas = results.filter(r => !r.ok);
  if (falhas.length === 0) {
    console.log("✅ Migração complementar COMPLETA!");
  } else {
    console.log(`⚠️  Tabelas com erro: ${falhas.map(r => r.name).join(", ")}`);
  }

  // ── Contagem final ────────────────────────────────────────────────
  console.log("\nContagem final no novo banco:");
  const check = ["people","team_members","parking_items","gamification_awards","attendance_records","area_notes","teams","gamification_actions"];
  for (const t of check) {
    const c = curlNewCount(t);
    console.log(`  ${pad(t)} ${c}`);
  }
  console.log("══════════════════════════════════════════════════\n");
  console.log("→ Faça login em https://buzzup0.vercel.app com:");
  console.log("  Email: brenonmarins05@gmail.com");
  console.log("  Senha: Bnm04102005_-\n");
}

main().catch(e => { console.error("\n❌", e.message); process.exit(1); });
