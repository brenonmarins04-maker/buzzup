import type { VercelRequest, VercelResponse } from "@vercel/node";

const SUPABASE_URL = "https://twwcnudhfvzbkdrtfmtu.supabase.co";

function cleanJwt(raw: string): string {
  return raw.replace(/[^A-Za-z0-9._\-]/g, "").trim();
}

const SERVICE_KEY = cleanJwt(process.env.SUPABASE_SERVICE_KEY || "");
// Anon key is public — used for the regular signup endpoint so Supabase
// respects the "Confirm email" setting and sends a verification email.
const ANON_KEY = cleanJwt(
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  ""
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, password, name } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email e password obrigatorios" });
  if (!SERVICE_KEY) return res.status(500).json({ error: "Configuracao do servidor incompleta" });

  try {
    let userId: string | null = null;

    if (ANON_KEY) {
      // Regular signup endpoint — Supabase sends confirmation email when
      // "Confirm email" is enabled in Auth → Settings.
      const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: "POST",
        headers: {
          apikey: ANON_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          data: { display_name: name || email.split("@")[0] },
        }),
      });

      const data = await r.json();

      if (!r.ok) {
        const msg =
          data?.msg || data?.message || data?.error_description || "Erro ao criar conta";
        if (
          msg.toLowerCase().includes("already") ||
          msg.toLowerCase().includes("registered") ||
          r.status === 422
        ) {
          return res.status(409).json({ error: "already_exists" });
        }
        return res.status(r.status).json({ error: msg });
      }

      // Empty identities array = email already registered (Supabase behaviour
      // when "Confirm email" is on and duplicate signup is attempted).
      if (Array.isArray(data?.identities) && data.identities.length === 0) {
        return res.status(409).json({ error: "already_exists" });
      }

      userId = data?.id || null;
    } else {
      // Fallback when anon key is not available: admin API without email confirmation.
      // To enable email confirmation add SUPABASE_ANON_KEY to Vercel env vars.
      const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: "POST",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
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

      userId = data?.id || null;
    }

    // Create profile with service key (no trigger exists in this project)
    if (userId) {
      const displayName = name || email.split("@")[0];
      await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
        method: "POST",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({ user_id: userId, display_name: displayName, email }),
      });
    }

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
