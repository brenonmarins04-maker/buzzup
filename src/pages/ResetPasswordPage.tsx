import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  clearStoredRecoverySession,
  consumeRecoveryResume,
  refreshStoredRecoverySession,
  registerRecoveryLinkUse,
  type RecoveryResumeResult,
} from "@/lib/recoverySession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Captured before Supabase removes the recovery tokens from the URL.
const INITIAL_HASH = typeof window !== "undefined" ? window.location.hash : "";

type RecoveryStatus = "checking" | "ready" | "invalid" | "expired" | "exhausted";

function tokensFromHash(hash: string) {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);
  return {
    accessToken: params.get("access_token"),
    refreshToken: params.get("refresh_token"),
    type: params.get("type"),
  };
}

function isRecoveryAccessToken(token: string) {
  try {
    const encoded = token.split(".")[1];
    if (!encoded) return false;
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as {
      amr?: Array<{ method?: string }>;
    };
    return claims.amr?.some((entry) => entry.method === "recovery") === true;
  } catch {
    return false;
  }
}

function statusFromResume(result: RecoveryResumeResult): RecoveryStatus {
  if (result.status === "available") return "ready";
  if (result.status === "expired") return "expired";
  if (result.status === "exhausted") return "exhausted";
  return "invalid";
}

export default function ResetPasswordPage() {
  const { updatePassword, endRecovery, isRecovering } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<RecoveryStatus>("checking");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;

    const setActiveStatus = (nextStatus: RecoveryStatus) => {
      if (active) setStatus(nextStatus);
    };

    const prepareRecovery = async () => {
      const hashTokens = tokensFromHash(window.location.hash || INITIAL_HASH);

      if (
        hashTokens.type === "recovery" &&
        hashTokens.accessToken &&
        hashTokens.refreshToken
      ) {
        const { data, error } = await supabase.auth.setSession({
          access_token: hashTokens.accessToken,
          refresh_token: hashTokens.refreshToken,
        });

        if (!error && data.session) {
          const registered = registerRecoveryLinkUse(
            data.session,
            hashTokens.refreshToken,
          );
          setActiveStatus(statusFromResume(registered));
          return;
        }
      }

      const resume = consumeRecoveryResume();
      if (resume.status === "available") {
        const { data, error } = await supabase.auth.setSession({
          access_token: resume.accessToken,
          refresh_token: resume.refreshToken,
        });
        if (!error && data.session) {
          refreshStoredRecoverySession(data.session);
          setActiveStatus("ready");
          return;
        }
        setActiveStatus("invalid");
        return;
      }
      if (resume.status !== "missing") {
        setActiveStatus(statusFromResume(resume));
        return;
      }

      // Supabase may have consumed the URL before this page mounted. In that
      // case, accept only a session whose verified JWT identifies recovery.
      const { data: { session } } = await supabase.auth.getSession();
      if (session && isRecoveryAccessToken(session.access_token)) {
        const registered = registerRecoveryLinkUse(session, session.refresh_token);
        setActiveStatus(statusFromResume(registered));
        return;
      }

      setActiveStatus("invalid");
    };

    void prepareRecovery();
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem");
      return;
    }

    setSubmitting(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("A sessão de recuperação não está mais disponível. Solicite um novo link.");
      setSubmitting(false);
      return;
    }

    const { error } = await updatePassword(password);
    if (error) {
      toast.error("Não foi possível atualizar a senha. Solicite um novo link e tente novamente.");
      setSubmitting(false);
      return;
    }

    clearStoredRecoverySession();
    toast.success("Senha redefinida com sucesso!");
    await endRecovery();
    setDone(true);
    setSubmitting(false);
  };

  const returnToLogin = async () => {
    clearStoredRecoverySession();
    if (isRecovering) await endRecovery();
    navigate("/login", { replace: true });
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm text-center space-y-5">
          <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Senha redefinida!</h1>
            <p className="text-sm text-muted-foreground">
              Sua senha já está salva. Volte ao login e entre normalmente com ela.
            </p>
          </div>
          <Button className="w-full rounded-2xl" onClick={() => navigate("/login", { replace: true })}>
            Ir para o login
          </Button>
        </div>
      </div>
    );
  }

  if (status === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Validando sua recuperação...
        </div>
      </div>
    );
  }

  if (status !== "ready") {
    const message = status === "exhausted"
      ? "Esta recuperação já foi retomada 10 vezes neste navegador. Solicite um novo link."
      : status === "expired"
        ? "Esta recuperação expirou. Solicite um novo link para continuar."
        : "Use o link mais recente enviado por e-mail para redefinir sua senha.";

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <h1 className="text-xl font-bold text-foreground">Link inválido ou expirado</h1>
          <p className="text-sm text-muted-foreground">{message}</p>
          <Button onClick={() => void returnToLogin()}>Voltar ao login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">BuzzUp</h1>
          <p className="text-sm text-muted-foreground">Definir nova senha</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nova senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
              required
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirmar senha</Label>
            <Input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="Repita a nova senha"
              autoComplete="new-password"
              required
              minLength={6}
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Aguarde..." : "Atualizar senha"}
          </Button>
        </form>
        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          Após o primeiro acesso, esta recuperação pode ser retomada até 10 vezes neste navegador,
          dentro do prazo de 1 hora.
        </p>
      </div>
    </div>
  );
}
