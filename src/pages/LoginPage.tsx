import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Mail, Lock, User } from "lucide-react";

export default function LoginPage() {
  const { user, loading, signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [justSignedUp, setJustSignedUp] = useState(false);
  const [emailConfirmNeeded, setEmailConfirmNeeded] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (user) return <Navigate to={justSignedUp ? "/welcome" : "/"} replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    // ── Recuperação de senha ────────────────────────────────────────
    if (mode === "forgot") {
      const { error } = await resetPassword(email);
      if (error) {
        toast.error("Erro ao enviar e-mail. Verifique o endereço.");
      } else {
        toast.success("E-mail de recuperação enviado! Verifique sua caixa.");
        setMode("login");
      }
      setSubmitting(false);
      return;
    }

    // ── Cadastro ────────────────────────────────────────────────────
    if (mode === "signup") {
      if (!name.trim()) {
        toast.error("Informe seu nome completo");
        setSubmitting(false);
        return;
      }
      if (password.length < 6) {
        toast.error("A senha deve ter pelo menos 6 caracteres");
        setSubmitting(false);
        return;
      }

      const { error } = await signUp(email, password, name.trim());
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("já está cadastrado") || msg.includes("already")) {
          toast.error("Este e-mail já está cadastrado. Tente fazer login.");
          setMode("login");
        } else {
          toast.error(error.message);
        }
        setSubmitting(false);
        return;
      }

      // Tenta logar; se e-mail não confirmado, exibe tela de confirmação
      const { error: loginErr } = await signIn(email, password);
      if (!loginErr) {
        setJustSignedUp(true);
      } else {
        const msg = (loginErr.message || "").toLowerCase();
        if (msg.includes("email not confirmed") || msg.includes("not_confirmed")) {
          setEmailConfirmNeeded(true);
        } else {
          toast.success("Conta criada! Faça login com seu e-mail e senha.");
          setMode("login");
        }
      }
      setSubmitting(false);
      return;
    }

    // ── Login ───────────────────────────────────────────────────────
    const { error } = await signIn(email, password);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("email not confirmed")) {
        setEmailConfirmNeeded(true);
        toast.error("Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.");
      } else if (msg.includes("invalid") || msg.includes("wrong") || msg.includes("credentials")) {
        toast.error("E-mail ou senha incorretos.");
      } else if (msg.includes("too many")) {
        toast.error("Muitas tentativas. Aguarde alguns minutos.");
      } else {
        toast.error("Erro ao entrar. Tente novamente.");
      }
    }
    setSubmitting(false);
  };

  // Tela de confirmação de e-mail
  if (emailConfirmNeeded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Confirme seu e-mail</h1>
            <p className="text-sm text-muted-foreground">
              Enviamos um link de confirmação para <strong>{email}</strong>.
              Clique no link do e-mail para ativar sua conta.
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Não recebeu?</p>
            <Button
              variant="outline"
              className="w-full"
              onClick={async () => {
                setSubmitting(true);
                // Re-envia tentando logar (Supabase re-envia automaticamente)
                await signIn(email, password);
                toast.info("Verifique sua caixa de entrada ou spam.");
                setSubmitting(false);
              }}
              disabled={submitting}
            >
              Reenviar e-mail
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => { setEmailConfirmNeeded(false); setMode("login"); }}>
              Voltar ao login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">

        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">BuzzUp</h1>
          <p className="text-sm text-muted-foreground">
            {mode === "forgot" ? "Recuperar senha" : mode === "signup" ? "Criar sua conta" : "Entrar na plataforma"}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome completo</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Seu nome completo"
                  className="pl-9"
                  autoFocus
                  required
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="pl-9"
                autoFocus={mode !== "signup"}
                required
              />
            </div>
          </div>

          {mode !== "forgot" && (
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9 pr-10"
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {mode === "signup" && (
                <p className="text-[11px] text-muted-foreground">Mínimo de 6 caracteres</p>
              )}
            </div>
          )}

          <Button type="submit" className="w-full h-10 font-semibold" disabled={submitting}>
            {submitting
              ? "Aguarde..."
              : mode === "forgot"
                ? "Enviar link de recuperação"
                : mode === "signup"
                  ? "Criar conta"
                  : "Entrar"}
          </Button>
        </form>

        {/* Links de navegação */}
        <div className="text-center space-y-2 text-sm">
          {mode === "login" && (
            <>
              <button
                onClick={() => { setMode("forgot"); setPassword(""); }}
                className="block w-full text-muted-foreground hover:text-foreground transition-colors"
              >
                Esqueci minha senha
              </button>
              <button
                onClick={() => { setMode("signup"); setPassword(""); }}
                className="block w-full text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Criar uma conta nova
              </button>
            </>
          )}

          {mode === "signup" && (
            <button
              onClick={() => { setMode("login"); setPassword(""); }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Já tenho conta — entrar
            </button>
          )}

          {mode === "forgot" && (
            <button
              onClick={() => setMode("login")}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Voltar ao login
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
