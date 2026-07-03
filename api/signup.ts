import type { VercelRequest, VercelResponse } from "@vercel/node";
import { initSentry, Sentry } from "./_sentry.js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://twwcnudhfvzbkdrtfmtu.supabase.co";

function cleanJwt(raw: string): string {
  return raw.replace(/[^A-Za-z0-9._\-]/g, "").trim();
}

const SERVICE_KEY = cleanJwt(process.env.SUPABASE_SERVICE_KEY || "");

// In-memory rate limiter: max 5 signup attempts per IP per minute.
// Per-instance only, but enough to slow down naive automated abuse.
const rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;

function setCors(req: VercelRequest, res: VercelResponse) {
  const origin = String(req.headers.origin || "");
  const allowedOrigin =
    /^https:\/\/buzzup0\.vercel\.app$/.test(origin) ||
    /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
      ? origin
      : "https://buzzup0.vercel.app";

  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

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

function isAlreadyRegistered(status: number, message: string) {
  const msg = message.toLowerCase();
  return status === 422 || msg.includes("already") || msg.includes("registered") || msg.includes("exists");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  initSentry();
  setCors(req, res);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: "too_many_requests", message: "Muitas tentativas. Aguarde 1 minuto." });
  }

  const { email, password, name } = req.body || {};
  const emailLower = String(email || "").trim().toLowerCase();
  if (!emailLower || !password) return res.status(400).json({ error: "email e password obrigatorios" });
  if (!SERVICE_KEY) return res.status(500).json({ error: "Configuracao do servidor incompleta" });

  try {
    // Use the admin API so signup does not hit public email-rate limits and
    // the user is confirmed immediately, allowing workspace creation right away.
    const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: emailLower,
        password,
        email_confirm: true,
        user_metadata: { display_name: name || emailLower.split("@")[0] },
      }),
    });

    const created = await createRes.json();
    if (!createRes.ok) {
      const msg = created?.msg || created?.message || created?.error_description || "Erro ao criar conta";
      if (isAlreadyRegistered(createRes.status, msg)) {
        return res.status(409).json({ error: "already_exists" });
      }
      return res.status(createRes.status).json({ error: msg });
    }

    const userId = created?.id || null;
    if (userId) {
      const displayName = name || emailLower.split("@")[0];
      await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
        method: "POST",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({ user_id: userId, display_name: displayName, email: emailLower }),
      });
    }

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    Sentry.captureException(e);
    return res.status(500).json({ error: e.message });
  }
}
