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
  const [leaving, setLeaving] = useState(false);
  // Ao abrir o link, o e-mail JÁ foi confirmado no servidor. A sessão criada
  // pelo link fica viva nesta aba — ela só é usada se a pessoa clicar em
  // "Entrar na sua conta". Ninguém é redirecionado automaticamente.
  const ok = hasToken && !error;

  // Se o usuário já tinha sessão (ex.: hash consumido antes do mount), ainda
  // consideramos confirmado — o servidor não gera sessão sem confirmar.
  const [sessionOk, setSessionOk] = useState(false);
  useEffect(() => {
    if (ok || error) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionOk(true);
    });
  }, [ok, error]);

  const confirmed = ok || sessionOk;

  // Botão verde: entra na conta usando a sessão do link → seleção de workspaces.
  const enterAccount = async () => {
    setLeaving(true);
    // Aguarda o client terminar de fixar a sessão do link (alguns instantes)
    for (let i = 0; i < 10; i++) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) { navigate("/welcome", { replace: true }); return; }
      await new Promise(r => setTimeout(r, 250));
    }
    // Sem sessão (link antigo/consumido) — segue para o login manual
    navigate("/login", { replace: true });
  };

  if (!confirmed) {
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
            Sua conta está ativa. Entre por aqui — ou volte para a tela onde
            estava criando a conta e toque em <strong>"Confirmei meu e-mail"</strong>.
          </p>
        </div>
        <Button
          onClick={enterAccount}
          disabled={leaving}
          className="w-full rounded-2xl h-12 font-bold bg-emerald-500 hover:bg-emerald-600 text-white border-0"
        >
          {leaving ? "Entrando…" : "Entrar na sua conta"}
        </Button>
      </div>
    </div>
  );
}
