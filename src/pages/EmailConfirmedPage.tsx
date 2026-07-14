import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
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
  const { user, loading } = useAuth();
  const [{ hasToken, error }] = useState(() => hashInfo(INITIAL_HASH));
  // ok imediato se o link trouxe token; senão espera a sessão carregar
  const [ok, setOk] = useState(hasToken && !error);

  useEffect(() => {
    if (!ok && !error && !loading && user) setOk(true);
  }, [ok, error, loading, user]);

  if (!ok && !error && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!ok) {
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
          <h1 className="text-2xl font-bold text-foreground tracking-tight">E-mail confirmado! 🎉</h1>
          <p className="text-sm text-muted-foreground">
            Sua conta está ativa. Você pode voltar ao seu login — ou, se estava
            aguardando no outro dispositivo, volte lá e toque em
            <strong> "Confirmei meu e-mail"</strong>.
          </p>
        </div>
        <Button className="w-full rounded-2xl h-12 font-bold" onClick={() => navigate("/login", { replace: true })}>
          Ir para o login
        </Button>
      </div>
    </div>
  );
}
