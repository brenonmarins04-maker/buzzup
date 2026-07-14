import type { VercelRequest, VercelResponse } from "@vercel/node";
import { initSentry, Sentry } from "./_sentry.js";

const DEFAULT_SUPABASE_URL = "https://twwcnudhfvzbkdrtfmtu.supabase.co";

function cleanJwt(raw: string): string {
  return raw.replace(/[^A-Za-z0-9._-]/g, "").trim();
}

function setCors(req: VercelRequest, res: VercelResponse) {
  const origin = String(req.headers.origin || "");
  const allowed =
    /^https:\/\/buzzup0\.vercel\.app$/.test(origin) ||
    /^https:\/\/([a-z0-9-]+\.)?usebuzzup\.com\.br$/.test(origin) ||
    /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

  if (allowed) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Cache-Control", "no-store");
}

function bearerToken(req: VercelRequest) {
  const header = String(req.headers.authorization || "");
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

function recoverySubject(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      sub?: string;
      amr?: Array<{ method?: string }>;
    };
    const isRecovery = claims.amr?.some((entry) => entry.method === "recovery");
    return isRecovery && claims.sub ? claims.sub : null;
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  initSentry();
  setCors(req, res);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  const serviceKey = cleanJwt(process.env.SUPABASE_SERVICE_KEY || "");
  const supabaseUrl = (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, "");
  if (!serviceKey) return res.status(500).json({ error: "server_config" });

  const token = bearerToken(req);
  const subject = recoverySubject(token);
  if (!token || !subject) return res.status(403).json({ error: "recovery_session_required" });

  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (password.length < 6 || password.length > 1_000) {
    return res.status(400).json({ error: "invalid_password" });
  }

  try {
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${token}`,
      },
    });
    const user = (await userResponse.json().catch(() => null)) as { id?: string } | null;
    if (!userResponse.ok || !user?.id || user.id !== subject) {
      return res.status(401).json({ error: "invalid_recovery_session" });
    }

    const updateResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${user.id}`, {
      method: "PUT",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password }),
    });

    if (!updateResponse.ok) {
      const detail = (await updateResponse.json().catch(() => null)) as {
        code?: string;
        error_code?: string;
      } | null;
      return res.status(400).json({
        error: detail?.code || detail?.error_code || "password_update_failed",
      });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    Sentry.captureException(error);
    return res.status(500).json({ error: "server_error" });
  }
}
