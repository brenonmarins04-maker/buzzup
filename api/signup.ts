import type { VercelRequest, VercelResponse } from "@vercel/node";

const SUPABASE_URL = "https://twwcnudhfvzbkdrtfmtu.supabase.co";

// JWT tokens only contain alphanumeric, dot, underscore, hyphen — strip everything else
function cleanJwt(raw: string): string {
  return raw.replace(/[^A-Za-z0-9._\-]/g, "").trim();
}

const SERVICE_KEY = cleanJwt(process.env.SUPABASE_SERVICE_KEY || "");

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, password, name } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email e password obrigatorios" });
  if (!SERVICE_KEY) return res.status(500).json({ error: "Configuracao do servidor incompleta" });

  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        "apikey": SERVICE_KEY,
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: name || email.split("@")[0] },
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      const msg = data?.msg || data?.message || "Erro ao criar conta";
      if (msg.toLowerCase().includes("already") || r.status === 422) {
        return res.status(409).json({ error: "already_exists" });
      }
      return res.status(r.status).json({ error: msg });
    }

    return res.status(200).json({ user: data });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
