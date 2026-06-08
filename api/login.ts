import type { VercelRequest, VercelResponse } from "@vercel/node";

const SUPABASE_URL = "https://twwcnudhfvzbkdrtfmtu.supabase.co";

function cleanJwt(raw: string): string {
  return raw.replace(/[^A-Za-z0-9._\-]/g, "").trim();
}

const SERVICE_KEY = cleanJwt(process.env.SUPABASE_SERVICE_KEY || "");

// Membros do PROJEC: entram com qualquer senha
const PROJEC_EMAILS = new Set([
  "joao.capri@projecjunior.com.br",
  "brenonmarins05@gmail.com",
  "marcello.ventilii@projecjunior.com.br",
  "ruan.nosralla@projecjunior.com.br",
  "melina.lotierso@projecjunior.com.br",
  "julia.calixto@projecjunior.com.br",
  "gabriella.locateli@projecjunior.com.br",
  "rodi@gmail.com",
  "leticia.mello@projecjunior.com.br",
  "mariana.casatti@projecjunior.com.br",
  "luan.prado@projecjunior.com.br",
  "mateus.mercante@projecjunior.com.br",
  "felipeffavaro@gmail.com",
  "leonardo.pizzotti@projecjunior.com.br",
  "isabella.morais@projecjunior.com.br",
  "felipe.gomes@projecjunior.com.br",
  "isabelle.antunes@projecjunior.com.br",
  "matheus.egydio@projecjunior.com.br",
  "julia.parizi@projecjunior.com.br",
  "rodrigo.tavares@projecjunior.com.br",
  "diogo.vilela@projecjunior.com.br",
  "marcela.yamaguchi@projecjunior.com.br",
  "ana.jaloretto@projecjunior.com.br",
  "pedro.matsui@projecjunior.com.br",
  "arthurapedro@projecjunior.com.br",
  "caroline.jesus@projecjunior.com.br",
  "gustavo.forti@projecjunior.com.br",
  "leonardo.cereser@projecjunior.com.br",
  "luiz.magalhaes@projecjunior.com.br",
  "mirela.nakajima@projecjunior.com.br",
  "bruna.massud@projecjunior.com.br",
  "ana.alves@projecjunior.com.br",
  "marianna.macari@projecjunior.com.br",
  "enrico.fratesi@projecjunior.com.br",
  "thomasterceiro@projecjunior.com.br",
  "diego.camargo@projecjunior.com.br",
  "gabriel.pontes@projecjunior.com.br",
  "gabriela.mayumisato@projecjunior.com.br",
  "gabriela.mayumi@projecjunior.com.br",
  "heloisa.gal@projecjunior.com.br",
]);

async function sbFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...opts,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  return res;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!SERVICE_KEY) {
    return res.status(500).json({ error: "server_config", message: "Configuração do servidor incompleta" });
  }

  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "email e senha são obrigatórios" });
  }

  const emailLower = String(email).toLowerCase().trim();

  // ── Modo PROJEC: qualquer senha é aceita ─────────────────────────────
  if (PROJEC_EMAILS.has(emailLower)) {
    // 1. Busca o usuário pelo email
    const listRes = await sbFetch(`/auth/v1/admin/users?email=${encodeURIComponent(emailLower)}`);
    const listData = await listRes.json();
    const user = listData?.users?.[0];

    if (!user) {
      return res.status(404).json({
        error: "not_found",
        message: "Conta não encontrada. Fale com um administrador.",
      });
    }

    // 2. Atualiza a senha para o que foi digitado (aceita qualquer senha)
    await sbFetch(`/auth/v1/admin/users/${user.id}`, {
      method: "PUT",
      body: JSON.stringify({ password, email_confirm: true }),
    });

    // 3. Faz login com email + nova senha
    const signInRes = await sbFetch("/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { apikey: SERVICE_KEY }, // usa anon/service key como apikey no header
      body: JSON.stringify({ email: emailLower, password }),
    });

    const session = await signInRes.json();

    if (session.error || session.error_code) {
      return res.status(401).json({
        error: "auth_failed",
        message: session.error_description || session.error || "Erro ao autenticar",
      });
    }

    return res.status(200).json(session);
  }

  // ── Login normal para contas fora do PROJEC ───────────────────────────
  const signInRes = await sbFetch("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email: emailLower, password }),
  });

  const session = await signInRes.json();

  if (session.error || session.error_code) {
    const isWrongPw = session.error_code === "invalid_credentials";
    return res.status(401).json({
      error: isWrongPw ? "invalid_credentials" : "auth_failed",
      message: isWrongPw
        ? "Email ou senha incorretos."
        : (session.error_description || session.error || "Erro ao autenticar"),
    });
  }

  return res.status(200).json(session);
}
