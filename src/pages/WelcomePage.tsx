import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Copy, KeyRound, Check, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export default function WelcomePage() {
  const { user, loading, accessCode, refreshMembership } = useAuth();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    // Garante que temos o código mais atual
    if (user && !accessCode) refreshMembership();
  }, [user, accessCode, refreshMembership]);

  const copy = () => {
    if (!accessCode) return;
    navigator.clipboard.writeText(accessCode);
    setCopied(true);
    toast.success("Código copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Bem-vindo ao BuzzUp</h1>
          <p className="text-sm text-muted-foreground">Seu workspace foi criado com sucesso</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <KeyRound className="h-4 w-4 text-primary" />
            Código de administrador
          </div>

          <button
            onClick={copy}
            className="w-full flex items-center justify-center gap-3 py-5 rounded-lg bg-muted hover:bg-accent transition-colors group"
          >
            <span className="font-mono text-3xl font-bold tracking-[0.4em] text-foreground">
              {accessCode || "------"}
            </span>
            {copied ? <Check className="h-5 w-5 text-status-done" /> : <Copy className="h-5 w-5 text-muted-foreground group-hover:text-foreground" />}
          </button>

          <div className="flex items-start gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
            <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-foreground/80 leading-relaxed">
              <strong>Salve este código em local seguro.</strong> Ele será necessário para liberar permissões de administrador no workspace. Sem ele, você só poderá visualizar o conteúdo.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Button onClick={copy} variant="outline" className="w-full">
            <Copy className="h-4 w-4 mr-2" /> Copiar código
          </Button>
          <Button onClick={() => navigate("/", { replace: true })} className="w-full">
            Já salvei, entrar no workspace
          </Button>
        </div>
      </div>
    </div>
  );
}