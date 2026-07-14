import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trackPlatformEvent } from "@/lib/platformAnalytics";
import { toast } from "sonner";
import { ArrowRight, Eye, EyeOff, Lock, Mail, User } from "lucide-react";

export default function LoginPage() {
  const { user, loading, signIn, signUp, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">(
    searchParams.get("mode") === "signup" ? "signup" : "login"
  );
  const [emailConfirmNeeded, setEmailConfirmNeeded] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return null;

  // Already logged in (page refresh) → redirect instantly
  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    if (mode === "forgot") {
      const { error } = await resetPassword(email);
      if (error) toast.error("Erro ao enviar e-mail. Verifique o endereço.");
      else { toast.success("E-mail de recuperação enviado!"); setMode("login"); }
      setSubmitting(false);
      return;
    }

    if (mode === "signup") {
      if (!name.trim()) { toast.error("Informe seu nome completo"); setSubmitting(false); return; }
      if (password.length < 6) { toast.error("A senha deve ter pelo menos 6 caracteres"); setSubmitting(false); return; }

      const { error } = await signUp(email, password, name.trim());
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("já está cadastrado") || msg.includes("already")) {
          toast.error("E-mail já cadastrado. Tente fazer login."); setMode("login");
        } else toast.error(error.message);
        setSubmitting(false);
        return;
      }

      await trackPlatformEvent("signup_success", {
        email,
        metadata: {
          source: "signup_form",
          name: name.trim(),
        },
      });

      const { error: loginErr } = await signIn(email, password);
      if (!loginErr) {
        navigate("/welcome", { replace: true });
      } else {
        const msg = (loginErr.message || "").toLowerCase();
        if (msg.includes("email not confirmed") || msg.includes("not_confirmed")) {
          setEmailConfirmNeeded(true);
        } else {
          toast.success("Conta criada! Faça login."); setMode("login");
        }
        setSubmitting(false);
      }
      return;
    }

    const { error } = await signIn(email, password);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("email not confirmed")) {
        setEmailConfirmNeeded(true);
        toast.error("Confirme seu e-mail antes de entrar.");
      } else if (msg.includes("invalid") || msg.includes("wrong") || msg.includes("credentials")) {
        toast.error("E-mail ou senha incorretos.");
      } else if (msg.includes("too many")) {
        toast.error("Muitas tentativas. Aguarde alguns minutos.");
      } else {
        toast.error("Erro ao entrar. Tente novamente.");
      }
      setSubmitting(false);
      return;
    }

    // Sucesso — AnimatePresence cuida da saída, navigate é imediato
    navigate("/welcome", { replace: true });
  };

  if (emailConfirmNeeded) {
    return (
      <div className="h-full flex items-center justify-center bg-white p-6">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Confirme seu e-mail</h1>
            <p className="text-sm text-muted-foreground">
              Enviamos um link de confirmação para <strong>{email}</strong>.
            </p>
          </div>
          <div className="space-y-2">
            <Button variant="outline" className="w-full rounded-2xl" onClick={async () => {
              setSubmitting(true);
              await signIn(email, password);
              toast.info("Verifique sua caixa de entrada ou spam.");
              setSubmitting(false);
            }} disabled={submitting}>
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
    : mode === "signup" ? "Crie sua conta para criar ou entrar em um workspace."
    : "Bem-vindo de volta. Acesse sua conta para continuar.";

  return (
    <div className="h-full flex items-center justify-center px-6 py-10 md:px-12 bg-accent lg:bg-white overflow-y-auto">
      <div className="w-full max-w-md lg:bg-transparent bg-white/70 lg:p-0 p-6 rounded-3xl lg:rounded-none lg:shadow-none shadow-xl shadow-primary/10 border border-primary/10 lg:border-0">
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
                <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome completo" className="h-16 rounded-2xl pl-14 text-base bg-[#f5f5f3]" autoFocus required />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="font-semibold">E-mail</Label>
            <div className="relative">
              <Mail className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@empresa.com" className="h-16 rounded-2xl pl-14 text-base bg-[#f5f5f3]" autoFocus={mode !== "signup"} required />
            </div>
          </div>

          {mode !== "forgot" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="font-semibold">Senha</Label>
                {mode === "login" && (
                  <button type="button" onClick={() => { setMode("forgot"); setPassword(""); }} className="text-sm font-semibold text-primary hover:text-primary/80">
                    Esqueceu?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="h-16 rounded-2xl pl-14 pr-12 text-base bg-[#f5f5f3]" minLength={6} required />
                <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {mode === "signup" && <p className="text-[11px] text-muted-foreground">Mínimo de 6 caracteres</p>}
            </div>
          )}

          <Button type="submit" className="w-full h-16 rounded-2xl text-base font-bold shadow-2xl shadow-primary/20 hover:-translate-y-0.5 transition-all" disabled={submitting}>
            {submitting ? "Aguarde..."
              : mode === "forgot" ? "Enviar link de recuperação"
              : mode === "signup" ? "Criar conta"
              : "Entrar"}
            {!submitting && <ArrowRight className="h-5 w-5 ml-2" />}
          </Button>
        </form>

        <div className="text-center space-y-2 text-sm mt-7">
          {mode === "login" && (
            <p className="text-muted-foreground">
              Não tem conta?{" "}
              <button
                onClick={() => {
                  trackPlatformEvent("signup_cta_click", { metadata: { source: "login_switch" } });
                  setMode("signup");
                  setPassword("");
                }}
                className="text-primary hover:text-primary/80 font-bold transition-colors"
              >
                Criar conta
              </button>
            </p>
          )}
          {mode === "signup" && (
            <button onClick={() => { setMode("login"); setPassword(""); }} className="text-muted-foreground hover:text-foreground transition-colors">
              Já tenho conta — entrar
            </button>
          )}
          {mode === "forgot" && (
            <button onClick={() => setMode("login")} className="text-muted-foreground hover:text-foreground transition-colors">
              Voltar ao login
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
