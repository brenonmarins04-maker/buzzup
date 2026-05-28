import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function WelcomePage() {
  const { user, loading, workspaceId, role, createWorkspace, acceptInvite, signOut } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (workspaceId && role) navigate("/", { replace: true });
  }, [workspaceId, role, navigate]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    const { ok, error } = await createWorkspace(name.trim());
    setBusy(false);
    if (ok) { toast.success("Workspace criado!"); navigate("/", { replace: true }); }
    else toast.error(error || "Erro ao criar workspace");
  };

  const onJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    const { ok, error } = await acceptInvite(code.trim().toUpperCase());
    setBusy(false);
    if (ok) { toast.success("Você entrou no workspace!"); navigate("/", { replace: true }); }
    else toast.error(error || "Convite inválido");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Bem-vindo ao BuzzUp</h1>
          <p className="text-sm text-muted-foreground">
            {mode === "choose" && "Crie um workspace ou entre em um existente."}
            {mode === "create" && "Dê um nome para o seu workspace."}
            {mode === "join" && "Digite o código de convite que você recebeu."}
          </p>
        </div>

        {mode === "choose" && (
          <div className="space-y-3">
            <Button className="w-full" onClick={() => setMode("create")}>Criar novo workspace</Button>
            <Button variant="outline" className="w-full" onClick={() => setMode("join")}>Entrar com código de convite</Button>
            <button onClick={() => signOut()} className="w-full text-xs text-muted-foreground hover:text-foreground pt-4">Sair</button>
          </div>
        )}

        {mode === "create" && (
          <form onSubmit={onCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ws-name">Nome do workspace</Label>
              <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Minha empresa" autoFocus />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "Criando..." : "Criar workspace"}</Button>
            <button type="button" onClick={() => setMode("choose")} className="w-full text-xs text-muted-foreground hover:text-foreground">Voltar</button>
          </form>
        )}

        {mode === "join" && (
          <form onSubmit={onJoin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ws-code">Código de convite</Label>
              <Input id="ws-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="BUZZ-XXXXXX" autoFocus className="font-mono tracking-wider" />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "Verificando..." : "Entrar no workspace"}</Button>
            <button type="button" onClick={() => setMode("choose")} className="w-full text-xs text-muted-foreground hover:text-foreground">Voltar</button>
          </form>
        )}
      </div>
    </div>
  );
}