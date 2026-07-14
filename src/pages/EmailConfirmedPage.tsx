import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, MailX } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

// Destino do link de confirmação de e-mail do cadastro.
// Captura o hash no carregamento do módulo, antes de o client do Supabase
// processar os tokens e limpar a URL.
const INITIAL_HASH = typeof window !== "undefined" ? window.location.hash : "";

function hashInfo(hash: string) {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const p = new URLSearchParams(raw);
  return {
    hasToken: !!p.get("access_token"),
    error: p.get("error_description") || p.get("error"),
  };
}

export default function EmailConfirmedPage() {
  const navigate = useNavigate();
  const [{ hasToken, error }] = useState(() => hashInfo(INITIAL_HASH));
  const [status, setStatus] = useState<"checking" | "ok" | "error">(error ? "error" : "checking");
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (error) { setStatus("error"); return; }
    let cancelled = false;
    (async () => {
      // Ao abrir o link, o e-mail JÁ foi confirmado no servidor do Supabase.
      // Aguardamos o token virar sessão e então DESLOGAMOS essa sessão criada
      // automaticamente — assim a pessoa não entra sozinha; ela precisa voltar
      // ao login e digitar a senha. Deslogar não desfaz a confirmação.
      for (let i = 0; i < 8; i++) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) break;
        await new Promise(r => setTimeout(r, 250));
      }
      try { await supabase.auth.signOut(); } catch { /* ignore */ }
      if (!cancelled) setStatus(hasToken ? "ok" : "error");
    })();
    return () => { cancelled = true; };
  }, [hasToken, error]);

  // Botão verde: garante o logout mais uma vez e leva ao login (entrada manual)
  const goToLogin = async () => {
    setLeaving(true);
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
    navigate("/login", { replace: true });
  };

  if (status === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm text-center space-y-5">
          <div className="h-16 w-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto">
            <MailX className="h-8 w-8 text-red-500" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Link inválido ou expirado</h1>
            <p className="text-sm text-muted-foreground">
              Cada link de confirmação vale uma única vez. Volte ao app e clique
              em "Reenviar e-mail" para receber um novo.
            </p>
          </div>
          <Button className="w-full rounded-2xl" onClick={() => navigate("/login", { replace: true })}>
            Voltar ao login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="flex justify-center">
          <BrandLogo markClassName="h-10 w-10" textClassName="text-xl text-foreground" />
        </div>
        <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">E-mail confirmado! ✅</h1>
          <p className="text-sm text-muted-foreground">
            Sua conta está ativa. Agora é só voltar para a tela de login e entrar
            com o seu e-mail e a sua senha.
          </p>
        </div>
        <Button
          onClick={goToLogin}
          disabled={leaving}
          className="w-full rounded-2xl h-12 font-bold bg-emerald-500 hover:bg-emerald-600 text-white border-0"
        >
          {leaving ? "Aguarde…" : "Voltar para o login"}
        </Button>
      </div>
    </div>
  );
}
