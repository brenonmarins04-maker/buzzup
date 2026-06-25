import type { VercelRequest, VercelResponse } from "@vercel/node";
import { initSentry, Sentry } from "./_sentry";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://twwcnudhfvzbkdrtfmtu.supabase.co";

function cleanJwt(raw: string): string {
  return raw.replace(/[^A-Za-z0-9._\-]/g, "").trim();
}

const SERVICE_KEY = cleanJwt(process.env.SUPABASE_SERVICE_KEY || "");
const ANON_KEY = cleanJwt(
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  ""
);

// In-memory rate limiter: max 5 signup attempts per IP per minute.
// Per-instance only (not global across Vercel instances) but still effective
// against naive automated abuse targeting a single deployment.
const rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;

function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress ?? "unknown";
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_MAX) return false;
  entry.count++;
  return true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  initSentry();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: "too_many_requests", message: "Muitas tentativas. Aguarde 1 minuto." });
  }

  const { email, password, name } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email e password obrigatorios" });
  if (!SERVICE_KEY) return res.status(500).json({ error: "Configuracao do servidor incompleta" });

  try {
    let userId: string | null = null;

    if (ANON_KEY) {
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

      if (Array.isArray(data?.identities) && data.identities.length === 0) {
        return res.status(409).json({ error: "already_exists" });
      }

      userId = data?.id || null;
    } else {
      // Fallback when anon key is not available: admin API without email confirmation.
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

    // Create profile with service key (requires SERVICE_KEY — admin-only operation)
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
    Sentry.captureException(e);
    return res.status(500).json({ error: e.message });
  }
}
