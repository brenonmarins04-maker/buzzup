import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function LoginPage() {
  const { user, loading, signIn, signUp, resetPassword, refreshMembership } = useAuth();
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [justSignedUp, setJustSignedUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
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

    if (isForgot) {
      const { error } = await resetPassword(email);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("E-mail de recuperação enviado!");
        setIsForgot(false);
      }
      setSubmitting(false);
      return;
    }

    if (isSignUp) {
      if (!name.trim()) {
        toast.error("Informe seu nome");
        setSubmitting(false);
        return;
      }
      const { error } = await signUp(email, password, name);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Conta criada! Entrando...");
        setJustSignedUp(true);
        const { error: loginError } = await signIn(email, password);
        if (loginError) toast.error(loginError.message);
      }
    } else {
      const { error } = await signIn(email, password);
      if (error) {
        toast.error("E-mail ou senha inválidos");
      } else {
        // Always require admin code re-entry on each login
        try {
          await (supabase.rpc as any)("demote_self_to_viewer");
          await refreshMembership();
        } catch {}
      }
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">BuzzUp</h1>
          <p className="text-sm text-muted-foreground">
            {isForgot ? "Recuperar senha" : isSignUp ? "Criar conta" : "Entrar no workspace"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && !isForgot && (
            <div className="space-y-2">
              <Label htmlFor="name">Seu nome</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome completo" />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required />
          </div>

          {!isForgot && (
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
            </div>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Aguarde..." : isForgot ? "Enviar e-mail" : isSignUp ? "Criar conta" : "Entrar"}
          </Button>
        </form>

        <div className="text-center space-y-2 text-sm">
          {!isForgot && (
            <button onClick={() => setIsForgot(true)} className="text-muted-foreground hover:text-foreground transition-colors">
              Esqueci minha senha
            </button>
          )}
          <div>
            <button
              onClick={() => { setIsSignUp(!isSignUp); setIsForgot(false); }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {isSignUp ? "Já tenho conta — entrar" : "Criar uma conta"}
            </button>
          </div>
          {isForgot && (
            <button onClick={() => setIsForgot(false)} className="text-muted-foreground hover:text-foreground transition-colors">
              Voltar ao login
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
