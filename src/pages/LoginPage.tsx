import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function LoginPage() {
  const { user, loading, signIn, signUp, resetPassword } = useAuth();
  const [params] = useSearchParams();
  const inviteToken = params.get("invite");

  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState<string | null>(null);
  const [inviteChecked, setInviteChecked] = useState(false);

  // If we have an invite token, look up the email and decide signup vs login
  useEffect(() => {
    if (!inviteToken) { setInviteChecked(true); return; }
    (async () => {
      const { data } = await supabase.from("workspace_invites")
        .select("email, status")
        .eq("token", inviteToken)
        .maybeSingle();
      if (data && data.status === "pending") {
        setInviteEmail(data.email);
        setEmail(data.email);
        // Check whether a user already exists with this email
        // We can't query auth.users directly — try sign-in flow defaults to signup unless user clicks "já tenho conta"
        setIsSignUp(true);
      }
      setInviteChecked(true);
    })();
  }, [inviteToken]);

  // Once user is logged in and we have an invite token, accept it
  useEffect(() => {
    if (user && inviteToken) {
      supabase.rpc("accept_invite" as any, { _token: inviteToken }).then(({ error }) => {
        if (error) console.warn("accept_invite:", error.message);
      });
    }
  }, [user, inviteToken]);

  if (loading || !inviteChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    if (isForgot) {
      const { error } = await resetPassword(email);
      if (error) toast.error(error.message);
      else { toast.success("E-mail de recuperação enviado!"); setIsForgot(false); }
      setSubmitting(false);
      return;
    }

    if (isSignUp) {
      if (!name.trim() && !inviteEmail) { toast.error("Informe seu nome"); setSubmitting(false); return; }
      if (password.length < 6) { toast.error("Senha deve ter no mínimo 6 caracteres"); setSubmitting(false); return; }
      if (password !== confirmPassword) { toast.error("As senhas não coincidem"); setSubmitting(false); return; }
      const { error } = await signUp(email, password, name || email.split("@")[0]);
      if (error) toast.error(error.message);
      else {
        toast.success("Conta criada! Entrando...");
        const { error: loginError } = await signIn(email, password);
        if (loginError) toast.error(loginError.message);
      }
    } else {
      const { error } = await signIn(email, password);
      if (error) toast.error("E-mail ou senha inválidos");
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">BuzzUp</h1>
          <p className="text-sm text-muted-foreground">
            {isForgot ? "Recuperar senha" : isSignUp ? (inviteEmail ? "Aceitar convite" : "Criar conta") : "Entrar no workspace"}
          </p>
          {inviteEmail && (
            <p className="text-xs text-muted-foreground">Você foi convidado para entrar como <strong>{inviteEmail}</strong></p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && !isForgot && !inviteEmail && (
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required disabled={!!inviteEmail} />
          </div>

          {!isForgot && (
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
            </div>
          )}

          {isSignUp && !isForgot && (
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmar senha</Label>
              <Input id="confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
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
