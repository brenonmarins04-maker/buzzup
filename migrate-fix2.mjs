/**
 * migrate-fix2.mjs — insere parking_items, gamification_awards, attendance_records
 * Nulifica campos FK que não existem no novo banco
 */
import { spawnSync } from "child_process";

const OLD_HOST = "ehuqbfbwgckusheiawsz.supabase.co";
const OLD_URL  = `https://${OLD_HOST}`;
const OLD_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVodXFiZmJ3Z2NrdXNoZWlhd3N6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwOTU5NzcsImV4cCI6MjA5MTY3MTk3N30.MUr3EPeKyJf1BT6_E2PpXcxWXZC8CalhK9FpCTeQXUs";
const OLD_RESOLVE = `${OLD_HOST}:443:104.18.38.10`;

const NEW_HOST = "twwcnudhfvzbkdrtfmtu.supabase.co";
const NEW_URL  = `https://${NEW_HOST}`;
const NEW_RESOLVE = `${NEW_HOST}:443:104.18.38.10`;
const NEW_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3d2NudWRoZnZ6YmtkcnRmbXR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDc1OTIyOSwiZXhwIjoyMDk2MzM1MjI5fQ.hyCQ_0W3Na5Y2h4N8zGqDwW6tuoy31FBk3zXsDZI76w";

function curlOld(path, token) {
  const r = spawnSync("curl", [
    "-s", "--resolve", OLD_RESOLVE, "--max-time", "30",
    "-H", `apikey: ${OLD_ANON}`,
    "-H", `Authorization: Bearer ${token}`,
    "-H", "Accept: application/json",
    `${OLD_URL}${path}`,
  ], { encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 });
  if (r.error) throw new Error(r.error.message);
  return JSON.parse(r.stdout);
}

function curlNewInsert(table, rows) {
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
  ], { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
  if (r.error) return r.error.message;
  if (r.stdout && r.stdout.trim()) {
    try {
      const p = JSON.parse(r.stdout);
      if (p && (p.code || p.error || p.message)) return p.message || p.error || JSON.stringify(p).slice(0,100);
    } catch {}
  }
  return null; // sucesso
}

function curlNewGet(table) {
  const r = spawnSync("curl", [
    "-s", "--resolve", NEW_RESOLVE, "--max-time", "30",
    "-H", `apikey: ${NEW_KEY}`,
    "-H", `Authorization: Bearer ${NEW_KEY}`,
    `${NEW_URL}/rest/v1/${table}?select=id&limit=500`,
  ], { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
  if (r.error) return new Set();
  try { return new Set(JSON.parse(r.stdout).map(r => r.id)); } catch { return new Set(); }
}

function login() {
  const r = spawnSync("curl", [
    "-s", "--resolve", OLD_RESOLVE, "--max-time", "20",
    "-X", "POST", "-H", `apikey: ${OLD_ANON}`, "-H", "Content-Type: application/json",
    "-d", JSON.stringify({ email: "brenonmarins05@gmail.com", password: "Bnm04102005_-" }),
    `${OLD_URL}/auth/v1/token?grant_type=password`,
  ], { encoding: "utf-8" });
  if (r.error) throw new Error(r.error.message);
  const d = JSON.parse(r.stdout);
  if (d.error) throw new Error(d.error_description || d.error);
  return d.access_token;
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

// Insere linha por linha, registrando falhas
function insertWithFallback(table, rows, nullifyFields = []) {
  let ok = 0, fail = 0, fallback = 0;
  const BATCH = 20;

  // tenta em lote primeiro
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const err = curlNewInsert(table, batch);
    if (!err) { ok += batch.length; continue; }

    // lote falhou: tenta 1 a 1 com nullify
    for (const row of batch) {
      const err1 = curlNewInsert(table, [row]);
      if (!err1) { ok++; continue; }

      // ainda falhou: nullifica campos FK e tenta
      if (nullifyFields.length > 0) {
        const clean = { ...row };
        nullifyFields.forEach(f => { clean[f] = null; });
        const err2 = curlNewInsert(table, [clean]);
        if (!err2) { fallback++; continue; }
      }
      fail++;
    }
  }
  return { ok, fail, fallback };
}

async function main() {
  console.log("\n╔═══════════════════════════════════════════════════╗");
  console.log("║  BuzzUp — Migração Fix2 (parking/gamif/presence)  ║");
  console.log("╚═══════════════════════════════════════════════════╝\n");

  process.stdout.write("🔐 Login... ");
  const token = login();
  console.log("✅");

  // Obtém IDs que existem no novo banco (para validar FKs)
  const newPeopleIds = curlNewGet("people");
  console.log(`\n📋 People no novo banco: ${newPeopleIds.size} IDs`);

  // ── parking_items ─────────────────────────────────────────────────
  process.stdout.write("\nparking_items... ");
  const parks = readAll("parking_items", token).map(r => ({
    ...r,
    // Se person_id não existe no novo banco, nulifica
    person_id: r.person_id && newPeopleIds.has(r.person_id) ? r.person_id : null,
  }));
  const pr = insertWithFallback("parking_items", parks);
  console.log(`✅ ${pr.ok} ok | ${pr.fallback} ajustados | ${pr.fail} falhas`);

  // ── gamification_awards ───────────────────────────────────────────
  process.stdout.write("gamification_awards... ");
  const awards = readAll("gamification_awards", token).map(r => ({
    ...r,
    person_id: r.person_id && newPeopleIds.has(r.person_id) ? r.person_id : null,
    awarded_by: null, // awarded_by pode referenciar auth.users — nulifica
  }));
  const ar = insertWithFallback("gamification_awards", awards);
  console.log(`✅ ${ar.ok} ok | ${ar.fallback} ajustados | ${ar.fail} falhas`);

  // ── attendance_records ────────────────────────────────────────────
  process.stdout.write("attendance_records... ");
  const att = readAll("attendance_records", token).map(r => ({
    ...r,
    person_id: r.person_id && newPeopleIds.has(r.person_id) ? r.person_id : null,
  }));
  const tr = insertWithFallback("attendance_records", att);
  console.log(`✅ ${tr.ok} ok | ${tr.fallback} ajustados | ${tr.fail} falhas`);

  // ── Contagem final ────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════");
  console.log("Contagem final:");
  const tables = ["people","team_members","parking_items","gamification_awards","gamification_actions","attendance_records","area_notes","attendance_settings","teams","calendar_items","event_types","lead_thermometer"];
  for (const t of tables) {
    const ids = curlNewGet(t);
    console.log(`  ${t.padEnd(28)} ${ids.size}`);
  }
  console.log("══════════════════════════════════════════════════\n");
  console.log("→ Login: brenonmarins05@gmail.com / Bnm04102005_-");
  console.log("→ Site:  https://buzzup0.vercel.app\n");
}

main().catch(e => { console.error("\n❌", e.message); process.exit(1); });
