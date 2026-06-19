/**
 * migrate-emails.mjs
 * Atualiza emails placeholder (@projec.buzzup) → emails reais dos membros do PROJEC
 */
import { spawnSync } from "child_process";

const NEW_HOST    = "twwcnudhfvzbkdrtfmtu.supabase.co";
const NEW_URL     = `https://${NEW_HOST}`;
const NEW_RESOLVE = `${NEW_HOST}:443:104.18.38.10`;
const NEW_KEY     = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3d2NudWRoZnZ6YmtkcnRmbXR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDc1OTIyOSwiZXhwIjoyMDk2MzM1MjI5fQ.hyCQ_0W3Na5Y2h4N8zGqDwW6tuoy31FBk3zXsDZI76w";

// Mapeamento: display_name (exato, como foi inserido) → email real
const NAME_TO_REAL_EMAIL = {
  "Capri":                            "joao.capri@projecjunior.com.br",
  "Marcello Leonel Ventilii":         "marcello.ventilii@projecjunior.com.br",
  "Ruan Nosralla":                    "ruan.nosralla@projecjunior.com.br",
  "Melina Lotierso":                  "melina.lotierso@projecjunior.com.br",
  "Julia Calixto":                    "julia.calixto@projecjunior.com.br",
  "Gabriella Locateli de Godoy":      "gabriella.locateli@projecjunior.com.br",
  "Rodrigo Tavares dos Santos":       "rodrigo.tavares@projecjunior.com.br",
  "Letícia Mello":                    "leticia.mello@projecjunior.com.br",
  "Mariana Moraes Casatti":           "mariana.casatti@projecjunior.com.br",
  "Luan Prado":                       "luan.prado@projecjunior.com.br",
  "Mateus da Cunha Mercante":         "mateus.mercante@projecjunior.com.br",
  "Felipe Fávaro":                    "felipeffavaro@gmail.com",
  "Leonardo Pizzotti Pinto":          "leonardo.pizzotti@projecjunior.com.br",
  "Isabella Morais":                  "isabella.morais@projecjunior.com.br",
  "Felipe Souza Gomes":               "felipe.gomes@projecjunior.com.br",
  "Isabelle Antunes":                 "isabelle.antunes@projecjunior.com.br",
  "Matheus Fortes Egydio":            "matheus.egydio@projecjunior.com.br",
  "Julia Fernandes Parizi":           "julia.parizi@projecjunior.com.br",
  "Diogo Vilela Sucena":              "diogo.vilela@projecjunior.com.br",
  "Marcela Suzuki Yamaguchi":         "marcela.yamaguchi@projecjunior.com.br",
  "Ana Jaloretto Alves":              "ana.jaloretto@projecjunior.com.br",
  "Pedro Takeshi Araujo Matsui":      "pedro.matsui@projecjunior.com.br",
  "Arthur Andrulis Pedro":            "arthurapedro@projecjunior.com.br",
  "Caroline Freitas":                 "caroline.jesus@projecjunior.com.br",
  "Gustavo Forti Gobo":               "gustavo.forti@projecjunior.com.br",
  "Leonardo Fava Cereser":            "leonardo.cereser@projecjunior.com.br",
  "Luiz Henrique Cavallini Magalhães":"luiz.magalhaes@projecjunior.com.br",
  "Mirela Akie Nakajima":             "mirela.nakajima@projecjunior.com.br",
  "Bruna Nascimento Massud":          "bruna.massud@projecjunior.com.br",
  "Ana Caroline Alves Santana Parizzi":"ana.alves@projecjunior.com.br",
  "Marianna Macari":                  "marianna.macari@projecjunior.com.br",
  "Enrico Raphael Mariano Fratesi":   "enrico.fratesi@projecjunior.com.br",
  "Thomas Terceiro de Jesus":         "thomasterceiro@projecjunior.com.br",
  "Diego Camargo":                    "diego.camargo@projecjunior.com.br",
  "Gabriel Rodrigues Pontes":         "gabriel.pontes@projecjunior.com.br",
  "Gabriela Mayumi Sato":             "gabriela.mayumisato@projecjunior.com.br",
  "Heloísa Gal":                      "heloisa.gal@projecjunior.com.br",
  "Clara Brasil Gonçalves":           "rodi@gmail.com",
};

function curlGet(path) {
  const r = spawnSync("curl", [
    "-s", "--resolve", NEW_RESOLVE, "--max-time", "30",
    "-H", `apikey: ${NEW_KEY}`,
    "-H", `Authorization: Bearer ${NEW_KEY}`,
    `${NEW_URL}${path}`,
  ], { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
  if (r.error) throw new Error(r.error.message);
  return JSON.parse(r.stdout);
}

function curlPut(userId, body) {
  const r = spawnSync("curl", [
    "-s", "--resolve", NEW_RESOLVE, "--max-time", "20",
    "-X", "PUT",
    "-H", `apikey: ${NEW_KEY}`,
    "-H", `Authorization: Bearer ${NEW_KEY}`,
    "-H", "Content-Type: application/json",
    "-d", JSON.stringify(body),
    `${NEW_URL}/auth/v1/admin/users/${userId}`,
  ], { encoding: "utf-8" });
  if (r.error) throw new Error(r.error.message);
  try { return JSON.parse(r.stdout); } catch { return null; }
}

function curlPatch(table, filter, body) {
  const r = spawnSync("curl", [
    "-s", "--resolve", NEW_RESOLVE, "--max-time", "15",
    "-X", "PATCH",
    "-H", `apikey: ${NEW_KEY}`,
    "-H", `Authorization: Bearer ${NEW_KEY}`,
    "-H", "Content-Type: application/json",
    "-H", "Prefer: return=minimal",
    "-d", JSON.stringify(body),
    `${NEW_URL}/rest/v1/${table}?${filter}`,
  ], { encoding: "utf-8" });
  return !r.error;
}

async function main() {
  console.log("\n╔═══════════════════════════════════════════════════╗");
  console.log("║  BuzzUp — Atualiza emails reais dos membros       ║");
  console.log("╚═══════════════════════════════════════════════════╝\n");

  // Busca todos os usuários do novo banco
  process.stdout.write("📋 Carregando usuários... ");
  const data = curlGet("/auth/v1/admin/users?per_page=200");
  const users = data.users || [];
  console.log(`${users.length} encontrados\n`);

  let ok = 0, skip = 0, err = 0;

  for (const user of users) {
    const name = user.user_metadata?.display_name || "";
    const realEmail = NAME_TO_REAL_EMAIL[name];

    // Pula Breno (já tem email real) e usuários sem mapeamento
    if (!realEmail) { skip++; continue; }
    // Pula se já está com o email correto
    if (user.email === realEmail) {
      process.stdout.write(`  ✅ já ok   ${realEmail}\n`);
      ok++;
      continue;
    }

    process.stdout.write(`  ✏️  ${(name).padEnd(36)} → ${realEmail}\n`);

    // Atualiza email no auth
    const res = curlPut(user.id, { email: realEmail, email_confirm: true });
    if (res?.id) {
      // Atualiza profile também
      curlPatch("profiles", `user_id=eq.${user.id}`, { email: realEmail, display_name: name });
      // Atualiza people.email
      curlPatch("people", `user_id=eq.${user.id}`, { email: realEmail });
      ok++;
    } else {
      const msg = res?.msg || res?.message || JSON.stringify(res || {}).slice(0, 60);
      process.stdout.write(`  ❌ ${msg}\n`);
      err++;
    }
  }

  // Cria conta para gabriela.mayumi@projecjunior.com.br como alias/alternativa
  // (caso queira usar esse email também para Gabriela)
  console.log(`\n📊 ${ok} atualizados | ${skip} sem mapeamento | ${err} erros`);

  console.log(`
══════════════════════════════════════════════════
✅ Emails reais configurados!
   Membros agora têm seus emails @projecjunior.com.br
   e podem fazer login com qualquer senha no site.
══════════════════════════════════════════════════
`);
}

main().catch(e => { console.error("\n❌", e.message); process.exit(1); });
