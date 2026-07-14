import type { VercelRequest, VercelResponse } from "@vercel/node";

// DESATIVADO na reformulação de segurança: este endpoint criava contas já
// confirmadas via API admin, pulando a verificação de e-mail. O cadastro
// agora usa supabase.auth.signUp no cliente, com confirmação de e-mail
// obrigatória (remetente contato@usebuzzup.com.br — ver email-setup-buzzup.md).
// Mantido apenas para responder 410 a bundles antigos em cache.

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  return res.status(410).json({
    error: "signup_disabled",
    message: "O cadastro foi atualizado e agora exige confirmação de e-mail. Recarregue a página (Ctrl+Shift+R) e tente novamente.",
  });
}
