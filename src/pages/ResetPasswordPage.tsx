import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

export default function ResetPasswordPage() {
  const { updatePassword, isRecovering, endRecovery, user } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // A flag global já captura o type=recovery de forma síncrona; se há sessão
    // de recuperação ou usuário logado via link, libera o formulário.
    if (isRecovering || user) { setReady(true); return; }

    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);
    if (hash.includes("type=recovery") || params.get("type") === "recovery") {
      setReady(true);
      return;
    }

    // Backup: o client dispara PASSWORD_RECOVERY ao validar o token do hash.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => subscription.unsubscribe();
  }, [isRecovering, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem");
      return;
    }
    setSubmitting(true);
    const { error } = await updatePassword(password);
    if (error) {
      toast.error("Não foi possível atualizar a senha. O link pode ter expirado.");
      setSubmitting(false);
      return;
    }
    // Senha salva no banco. Desloga a sessão temporária do link e mostra a
    // confirmação — o usuário volta e faz login normalmente com a nova senha.
    toast.success("Senha redefinida com sucesso!");
    await endRecovery();
    setDone(true);
    setSubmitting(false);
  };

  // Tela final: senha redefinida, sem ir para lugar nenhum automaticamente
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
              Sua nova senha já está salva. Volte ao login e entre normalmente com ela.
            </p>
          </div>
          <Button className="w-full rounded-2xl" onClick={() => navigate("/login", { replace: true })}>
            Ir para o login
          </Button>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <h1 className="text-xl font-bold text-foreground">Link inválido ou expirado</h1>
          <p className="text-sm text-muted-foreground">
            Use o link enviado por e-mail para redefinir sua senha. Links expiram em 1 hora.
          </p>
          <Button onClick={() => navigate("/login")}>Voltar ao login</Button>
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
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
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
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repita a nova senha"
              required
              minLength={6}
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Aguarde..." : "Atualizar senha"}
          </Button>
        </form>
      </div>
    </div>
  );
}
