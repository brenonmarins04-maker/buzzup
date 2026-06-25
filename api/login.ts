import type { VercelRequest, VercelResponse } from "@vercel/node";
import { initSentry, Sentry } from "./_sentry";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://twwcnudhfvzbkdrtfmtu.supabase.co";

function cleanJwt(raw: string): string {
  return raw.replace(/[^A-Za-z0-9._\-]/g, "").trim();
}

const SERVICE_KEY = cleanJwt(process.env.SUPABASE_SERVICE_KEY || "");

export default async function handler(req: VercelRequest, res: VercelResponse) {
  initSentry();
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

  try {
    const signInRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: emailLower, password }),
    });

    const session = await signInRes.json();

    if (session.error || session.error_code) {
      const isWrongCreds = session.error_code === "invalid_credentials"
        || (session.error || "").toLowerCase().includes("invalid")
        || signInRes.status === 400
        || signInRes.status === 401;
      return res.status(401).json({
        error: isWrongCreds ? "invalid_credentials" : "auth_failed",
        message: isWrongCreds
          ? "Email ou senha incorretos."
          : (session.error_description || session.error || "Erro ao autenticar"),
      });
    }

    return res.status(200).json(session);
  } catch (e: any) {
    Sentry.captureException(e);
    return res.status(500).json({ error: "server_error", message: e.message });
  }
}
