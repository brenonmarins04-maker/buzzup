/**
 * migrate-users.mjs
 * Recupera todas as contas e acessos ao workspace PROJEC
 * Para cada membro: cria auth user + restaura workspace_member com role correto
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

const PROJEC_WS  = "28ccdca6-c176-45af-b4cc-50d2818575bf";
const OLD_BRENO  = "45f5c566-a6bb-421f-b215-d00db52c6aee";
const NEW_BRENO  = "cfe254b3-fcbe-48b9-bda6-cc3b48593dd4";

function curlOld(path, token) {
  const r = spawnSync("curl", [
    "-s", "--resolve", OLD_RESOLVE, "--max-time", "30",
    "-H", `apikey: ${OLD_ANON}`,
    "-H", `Authorization: Bearer ${token}`,
    "-H", "Accept: application/json",
    `${OLD_URL}${path}`,
  ], { encoding: "utf-8", maxBuffer: 20 * 1024 * 1024 });
  if (r.error) throw new Error(r.error.message);
  return JSON.parse(r.stdout);
}

function curlNewPost(path, body) {
  const r = spawnSync("curl", [
    "-s", "--resolve", NEW_RESOLVE, "--max-time", "30",
    "-X", "POST",
    "-H", `apikey: ${NEW_KEY}`,
    "-H", `Authorization: Bearer ${NEW_KEY}`,
    "-H", "Content-Type: application/json",
    "-d", JSON.stringify(body),
    `${NEW_URL}${path}`,
  ], { encoding: "utf-8", maxBuffer: 5 * 1024 * 1024 });
  if (r.error) throw new Error(r.error.message);
  try { return JSON.parse(r.stdout); } catch { return null; }
}

function curlNewUpsert(table, rows) {
  if (!rows.length) return;
  const r = spawnSync("curl", [
    "-s", "--resolve", NEW_RESOLVE, "--max-time", "30",
    "-X", "POST",
    "-H", `apikey: ${NEW_KEY}`,
    "-H", `Authorization: Bearer ${NEW_KEY}`,
    "-H", "Content-Type: application/json",
    "-H", "Prefer: resolution=merge-duplicates,return=minimal",
    "-d", JSON.stringify(rows),
    `${NEW_URL}/rest/v1/${table}`,
  ], { encoding: "utf-8", maxBuffer: 5 * 1024 * 1024 });
  if (r.error) throw new Error(r.error.message);
  if (r.stdout?.trim()) {
    try {
      const p = JSON.parse(r.stdout);
      if (p?.code || p?.error) return p.message || p.error;
    } catch {}
  }
  return null;
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

// Gera email de placeholder a partir do nome
function nameToEmail(name) {
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // remove acentos
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join(".")
    + "@projec.buzzup";
}

async function main() {
  console.log("\n╔═══════════════════════════════════════════════════╗");
  console.log("║    BuzzUp — Recuperação de Contas e Acessos       ║");
  console.log("╚═══════════════════════════════════════════════════╝\n");

  process.stdout.write("🔐 Login no Lovable... ");
  const token = login();
  console.log("✅");

  // Busca dados do banco antigo
  const members  = curlOld("/rest/v1/workspace_members?select=*&limit=500", token);
  const people   = curlOld("/rest/v1/people?select=*&limit=500", token);
  const profiles = curlOld("/rest/v1/profiles?select=*&limit=500", token);

  // Mapeia old_user_id → name e email
  const uidToName  = {};
  const uidToEmail = {};
  for (const p of profiles) {
    uidToName[p.user_id]  = p.display_name || "";
    uidToEmail[p.user_id] = p.email || "";
  }
  for (const p of people) {
    if (p.user_id) {
      if (!uidToName[p.user_id])  uidToName[p.user_id]  = p.name || "";
      if (!uidToEmail[p.user_id]) uidToEmail[p.user_id] = p.email || "";
    }
  }

  console.log(`\n📋 ${members.length} workspace_members encontrados no PROJEC`);
  console.log("─────────────────────────────────────────────────────\n");

  // Mapa: old_user_id → new_user_id
  const uidMap = { [OLD_BRENO]: NEW_BRENO };

  let criados = 0, jaExistia = 0, erros = 0;

  for (const m of members) {
    const oldUid = m.user_id;
    if (oldUid === OLD_BRENO) { uidMap[oldUid] = NEW_BRENO; continue; } // Breno já existe

    const name  = uidToName[oldUid]  || `Membro ${oldUid.slice(0,6)}`;
    const email = uidToEmail[oldUid] || nameToEmail(name);

    process.stdout.write(`  ${m.role.padEnd(8)} ${name.padEnd(35)} `);

    // Cria auth user no novo banco
    const res = curlNewPost("/auth/v1/admin/users", {
      email,
      password: "Projec@2026",     // senha padrão — podem redefinir depois
      email_confirm: true,
      user_metadata: { display_name: name },
    });

    let newUid = res?.id;
    if (!newUid) {
      // Usuário já existe com esse email — busca o ID existente
      const listRes = curlNewPost("/auth/v1/admin/users", null);
      // tenta GET
      const getR = spawnSync("curl", [
        "-s", "--resolve", NEW_RESOLVE, "--max-time", "15",
        "-H", `apikey: ${NEW_KEY}`,
        "-H", `Authorization: Bearer ${NEW_KEY}`,
        `${NEW_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
      ], { encoding: "utf-8" });
      try {
        const users = JSON.parse(getR.stdout)?.users || [];
        newUid = users.find(u => u.email === email)?.id;
      } catch {}
    }

    if (newUid) {
      uidMap[oldUid] = newUid;
      // Cria profile
      curlNewUpsert("profiles", [{ user_id: newUid, display_name: name, email }]);
      process.stdout.write(`✅ ${newUid.slice(0,8)}...\n`);
      criados++;
    } else {
      const msg = res?.msg || res?.message || JSON.stringify(res || {}).slice(0,60);
      if (msg.toLowerCase().includes("already")) {
        process.stdout.write(`♻️  já existe\n`);
        jaExistia++;
      } else {
        process.stdout.write(`❌ ${msg}\n`);
        erros++;
      }
    }
  }

  console.log(`\n📊 Contas: ${criados} criadas | ${jaExistia} já existiam | ${erros} erros`);
  console.log("─────────────────────────────────────────────────────\n");

  // Restaura workspace_members com novos user_ids
  console.log("🔗 Restaurando workspace_members no PROJEC...\n");
  const newMembers = [];
  for (const m of members) {
    const newUid = uidMap[m.user_id];
    if (!newUid) { console.log(`  ⚠️  Sem mapeamento para ${m.user_id.slice(0,8)}...`); continue; }
    newMembers.push({
      id:           m.id,
      workspace_id: m.workspace_id,
      user_id:      newUid,
      role:         m.role,
      created_at:   m.created_at,
    });
  }

  // Upsert em lotes
  const BATCH = 20;
  let okCount = 0;
  for (let i = 0; i < newMembers.length; i += BATCH) {
    const batch = newMembers.slice(i, i + BATCH);
    const err = curlNewUpsert("workspace_members", batch);
    if (err) console.log(`  ⚠️  Lote ${i}-${i+BATCH}: ${err}`);
    else okCount += batch.length;
  }

  // Atualiza people.user_id para os mapeados
  console.log("\n🔗 Atualizando people.user_id com novos IDs...");
  let peopleUpdated = 0;
  for (const p of people) {
    if (!p.user_id || !uidMap[p.user_id]) continue;
    const newUid = uidMap[p.user_id];
    const r = spawnSync("curl", [
      "-s", "--resolve", NEW_RESOLVE, "--max-time", "15",
      "-X", "PATCH",
      "-H", `apikey: ${NEW_KEY}`,
      "-H", `Authorization: Bearer ${NEW_KEY}`,
      "-H", "Content-Type: application/json",
      "-H", "Prefer: return=minimal",
      "-d", JSON.stringify({ user_id: newUid }),
      `${NEW_URL}/rest/v1/people?id=eq.${p.id}`,
    ], { encoding: "utf-8" });
    if (!r.error) peopleUpdated++;
  }

  console.log(`  ✅ ${okCount}/${newMembers.length} workspace_members restaurados`);
  console.log(`  ✅ ${peopleUpdated} people.user_id atualizados`);

  console.log(`
══════════════════════════════════════════════════
✅ CONTAS E ACESSOS RESTAURADOS!

📌 IMPORTANTE:
   Os membros agora têm contas com:
   • Email: <nome.sobrenome>@projec.buzzup  (placeholder)
   • Senha padrão: Projec@2026

   Para cada membro acessar com o email REAL deles:
   1. Vá em supabase.com/dashboard/project/twwcnudhfvzbkdrtfmtu
   2. Authentication → Users
   3. Edite o email do usuário para o email real

   OU: membro faz cadastro com email real →
       você vai em Authentication → Users → edita o user_id

→ Você (Breno): brenonmarins05@gmail.com / Bnm04102005_-
→ Site: https://buzzup0.vercel.app
══════════════════════════════════════════════════
`);
}

main().catch(e => { console.error("\n❌", e.message); process.exit(1); });
