import type { VercelRequest, VercelResponse } from "@vercel/node";

const SUPABASE_URL = "https://twwcnudhfvzbkdrtfmtu.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, password, name } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email e password obrigatórios" });
  if (!SERVICE_KEY) return res.status(500).json({ error: "Configuração do servidor incompleta" });

  try {
    // Use admin API to create user with email auto-confirmed
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
      // If user already exists, return a specific code so frontend can try login
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
