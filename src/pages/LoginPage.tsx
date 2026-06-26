import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowRight, Eye, EyeOff, Lock, Mail, User } from "lucide-react";

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
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (user) return <Navigate to={justSignedUp ? "/welcome" : "/"} replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

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

  if (emailConfirmNeeded) {
    return (
      <div className="h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-6 text-center glass-panel rounded-[28px] p-8">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
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
              className="w-full rounded-2xl"
              onClick={async () => {
                setSubmitting(true);
                await signIn(email, password);
                toast.info("Verifique sua caixa de entrada ou spam.");
                setSubmitting(false);
              }}
              disabled={submitting}
            >
              Reenviar e-mail
            </Button>
            <Button variant="ghost" className="w-full rounded-2xl" onClick={() => { setEmailConfirmNeeded(false); setMode("login"); }}>
              Voltar ao login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const title = mode === "forgot" ? "Recuperar senha" : mode === "signup" ? "Criar conta" : "Entrar";
  const subtitle = mode === "forgot"
    ? "Informe seu e-mail para receber o link de recuperação."
    : mode === "signup"
      ? "Crie sua conta para entrar no workspace."
      : "Bem-vindo de volta. Acesse sua conta para continuar.";

  return (
    <div className="h-screen overflow-hidden grid grid-cols-1 lg:grid-cols-[0.92fr_1fr] bg-background">
      {/* Painel azul */}
      <section className="login-blue-panel text-white p-7 md:p-10 lg:p-12 flex flex-col justify-between min-h-[220px] lg:min-h-0">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-white/16 flex items-center justify-center font-extrabold text-2xl shadow-lg shadow-black/10">B</div>
          <span className="text-2xl font-extrabold tracking-tight">BuzzUp</span>
        </div>
        <div className="max-w-lg py-10 lg:py-0">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-[0.98]">
            Gestão de times,<br />sem nenhum ruído.
          </h1>
          <p className="mt-6 text-lg md:text-xl leading-relaxed text-white/84">
            Workspaces, pedidos e demandas em um só lugar, feito para assessores e diretores que precisam de clareza.
          </p>
        </div>
        <p className="hidden lg:block text-sm text-white/50">© 2026 BuzzUp</p>
      </section>

      {/* Painel do formulário */}
      <section className="flex items-center justify-center px-6 py-10 md:px-12 bg-white overflow-y-auto">
        <div className="w-full max-w-md">
          <div className="mb-9">
            <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">{title}</h2>
            <p className="text-base text-muted-foreground mt-3">{subtitle}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name" className="font-semibold">Nome completo</Label>
                <div className="relative">
                  <User className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Seu nome completo"
                    className="h-16 rounded-2xl pl-14 text-base bg-[#f5f5f3]"
                    autoFocus
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="font-semibold">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="voce@empresa.com"
                  className="h-16 rounded-2xl pl-14 text-base bg-[#f5f5f3]"
                  autoFocus={mode !== "signup"}
                  required
                />
              </div>
            </div>

            {mode !== "forgot" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="font-semibold">Senha</Label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => { setMode("forgot"); setPassword(""); }}
                      className="text-sm font-semibold text-primary hover:text-primary/80"
                    >
                      Esqueceu?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-16 rounded-2xl pl-14 pr-12 text-base bg-[#f5f5f3]"
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {mode === "signup" && (
                  <p className="text-[11px] text-muted-foreground">Mínimo de 6 caracteres</p>
                )}
              </div>
            )}

            <Button type="submit" className="w-full h-16 rounded-2xl text-base font-bold shadow-2xl shadow-primary/20 hover:-translate-y-0.5 transition-all" disabled={submitting}>
              {submitting
                ? "Aguarde..."
                : mode === "forgot"
                  ? "Enviar link de recuperação"
                  : mode === "signup"
                    ? "Criar conta"
                    : "Entrar"}
              {!submitting && <ArrowRight className="h-5 w-5 ml-2" />}
            </Button>
          </form>

          <div className="text-center space-y-2 text-sm mt-7">
            {mode === "login" && (
              <p className="text-muted-foreground">
                Não tem conta?{" "}
                <button
                  onClick={() => { setMode("signup"); setPassword(""); }}
                  className="text-primary hover:text-primary/80 font-bold transition-colors"
                >
                  Criar conta
                </button>
              </p>
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
                Voltar ao login
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
