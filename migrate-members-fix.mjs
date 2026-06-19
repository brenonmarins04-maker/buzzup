/**
 * migrate-members-fix.mjs
 * Limpa workspace_members e reinicia com todos os 39 membros mapeados corretamente
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

const OLD_BRENO = "45f5c566-a6bb-421f-b215-d00db52c6aee";
const NEW_BRENO = "cfe254b3-fcbe-48b9-bda6-cc3b48593dd4";
const PROJEC_WS = "28ccdca6-c176-45af-b4cc-50d2818575bf";

function curlOld(path, token) {
  const r = spawnSync("curl", [
    "-s", "--resolve", OLD_RESOLVE, "--max-time", "30",
    "-H", `apikey: ${OLD_ANON}`,
    "-H", `Authorization: Bearer ${token}`,
    `${OLD_URL}${path}`,
  ], { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
  if (r.error) throw new Error(r.error.message);
  return JSON.parse(r.stdout);
}

function curlNew(method, path, body) {
  const args = ["-s", "--resolve", NEW_RESOLVE, "--max-time", "30",
    "-X", method,
    "-H", `apikey: ${NEW_KEY}`,
    "-H", `Authorization: Bearer ${NEW_KEY}`,
    "-H", "Content-Type: application/json",
    "-H", "Prefer: return=minimal",
  ];
  if (body !== undefined) { args.push("-d", JSON.stringify(body)); }
  args.push(`${NEW_URL}${path}`);
  const r = spawnSync("curl", args, { encoding: "utf-8", maxBuffer: 5 * 1024 * 1024 });
  if (r.error) throw new Error(r.error.message);
  if (r.stdout?.trim()) {
    try {
      const p = JSON.parse(r.stdout);
      if (p?.code || p?.message?.includes("violates")) return { error: p.message || p.error };
    } catch {}
  }
  return { ok: true };
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

function getNewUsers() {
  // Busca usuários criados no novo banco pela API admin
  const r = spawnSync("curl", [
    "-s", "--resolve", NEW_RESOLVE, "--max-time", "30",
    "-H", `apikey: ${NEW_KEY}`,
    "-H", `Authorization: Bearer ${NEW_KEY}`,
    `${NEW_URL}/auth/v1/admin/users?per_page=200`,
  ], { encoding: "utf-8", maxBuffer: 5 * 1024 * 1024 });
  if (r.error) throw new Error(r.error.message);
  const d = JSON.parse(r.stdout);
  return d.users || [];
}

function nameToEmail(name) {
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join(".")
    + "@projec.buzzup";
}

async function main() {
  console.log("\n╔═══════════════════════════════════════════════════╗");
  console.log("║  BuzzUp — Fix workspace_members (remapeia IDs)    ║");
  console.log("╚═══════════════════════════════════════════════════╝\n");

  process.stdout.write("🔐 Login no Lovable... ");
  const token = login();
  console.log("✅");

  // Dados do banco antigo
  const oldMembers = curlOld("/rest/v1/workspace_members?select=*&limit=500", token);
  const oldPeople  = curlOld("/rest/v1/people?select=*&limit=500", token);
  const oldProfiles= curlOld("/rest/v1/profiles?select=*&limit=500", token);

  // Dados dos novos usuários criados
  process.stdout.write("📋 Carregando usuários do novo banco... ");
  const newUsers = getNewUsers();
  console.log(`${newUsers.length} usuários`);

  // Constrói map email → new_user_id
  const emailToNewId = {};
  for (const u of newUsers) { emailToNewId[u.email] = u.id; }

  // Constrói map old_uid → name e email
  const uidToName  = {};
  const uidToEmail = {};
  for (const p of oldProfiles) {
    uidToName[p.user_id]  = p.display_name || "";
    uidToEmail[p.user_id] = p.email || "";
  }
  for (const p of oldPeople) {
    if (p.user_id) {
      if (!uidToName[p.user_id])  uidToName[p.user_id]  = p.name || "";
      if (!uidToEmail[p.user_id]) uidToEmail[p.user_id] = p.email || "";
    }
  }

  // Constrói mapa old_uid → new_uid
  const uidMap = {};
  uidMap[OLD_BRENO] = NEW_BRENO; // Breno mapeado diretamente
  for (const m of oldMembers) {
    if (m.user_id === OLD_BRENO) continue;
    const name  = uidToName[m.user_id]  || `Membro ${m.user_id.slice(0,6)}`;
    const email = uidToEmail[m.user_id] || nameToEmail(name);
    const newId = emailToNewId[email];
    if (newId) { uidMap[m.user_id] = newId; }
    else { console.log(`  ⚠️  Sem usuario para ${name} (${email})`); }
  }

  console.log(`\n✅ ${Object.keys(uidMap).length}/39 mapeamentos construídos`);

  // 1. Apaga todos os workspace_members do PROJEC no novo banco
  process.stdout.write("\n🗑️  Limpando workspace_members antigos... ");
  const delResult = curlNew("DELETE", `/rest/v1/workspace_members?workspace_id=eq.${PROJEC_WS}`);
  console.log(delResult.ok ? "✅" : `⚠️ ${delResult.error}`);

  // 2. Monta registros com novos user_ids
  const toInsert = [];
  for (const m of oldMembers) {
    const newUid = uidMap[m.user_id];
    if (!newUid) { console.log(`  ⚠️  Sem mapeamento para ${m.user_id.slice(0,8)}...`); continue; }
    toInsert.push({
      id:           m.id,
      workspace_id: m.workspace_id,
      user_id:      newUid,
      role:         m.role,
      created_at:   m.created_at,
    });
  }

  // 3. Insere em lotes (sem duplicate conflict agora pois apagamos tudo)
  console.log(`\n🔗 Inserindo ${toInsert.length} workspace_members...`);
  const BATCH = 20;
  let ok = 0;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    const r = curlNew("POST", "/rest/v1/workspace_members", batch);
    if (r.ok) { ok += batch.length; }
    else { console.log(`  ⚠️  Lote ${i}-${i+BATCH}: ${r.error}`); }
  }

  // Verifica contagem
  const checkR = spawnSync("curl", [
    "-s", "--resolve", NEW_RESOLVE, "--max-time", "15",
    "-H", `apikey: ${NEW_KEY}`,
    "-H", `Authorization: Bearer ${NEW_KEY}`,
    `${NEW_URL}/rest/v1/workspace_members?workspace_id=eq.${PROJEC_WS}&select=id,role,user_id`,
  ], { encoding: "utf-8" });
  const finalCount = JSON.parse(checkR.stdout)?.length || 0;

  console.log(`\n╔═══════════════════════════════════════════════════╗`);
  console.log(`║  ✅  ${finalCount}/39 membros no workspace PROJEC         ║`);
  console.log(`╚═══════════════════════════════════════════════════╝`);
  console.log(`
📌 MEMBROS E SUAS CREDENCIAIS:
   • Admins: Melina Lotierso, Ruan Nosralla, Marcello Leonel Ventilii
   • Email:  <nome.sobrenome>@projec.buzzup
   • Senha:  Projec@2026

   Seu login (Breno, admin):
   • Email:  brenonmarins05@gmail.com
   • Senha:  Bnm04102005_-

   Site: https://buzzup0.vercel.app
`);
}

main().catch(e => { console.error("\n❌", e.message); process.exit(1); });
