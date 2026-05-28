import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles, KeyRound, ArrowRight, ArrowLeft, LogOut } from "lucide-react";

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
    if (ok) { toast.success("Você entrou no workspace com sucesso."); navigate("/", { replace: true }); }
    else toast.error(error || "Convite inválido");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border/50">
        <div className="text-sm font-semibold tracking-tight">BuzzUp</div>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" /> Sair
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-3xl">
          {mode === "choose" && (
            <div className="space-y-10">
              <div className="text-center space-y-3 max-w-xl mx-auto">
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
                  Como você quer começar?
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Crie um novo workspace para sua empresa ou entre em um ambiente
                  existente usando um código de convite.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <button
                  onClick={() => setMode("create")}
                  className="group text-left rounded-2xl border border-border bg-card p-6 hover:border-primary hover:shadow-lg transition-all"
                >
                  <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg font-semibold text-foreground mb-1.5">
                    Criar um novo workspace
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                    Você será o <span className="font-medium text-foreground">Owner</span> e
                    poderá configurar o ambiente, convidar admins e adicionar
                    members.
                  </p>
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary group-hover:gap-2.5 transition-all">
                    Criar workspace <ArrowRight className="h-4 w-4" />
                  </span>
                </button>

                <button
                  onClick={() => setMode("join")}
                  className="group text-left rounded-2xl border border-border bg-card p-6 hover:border-primary hover:shadow-lg transition-all"
                >
                  <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg font-semibold text-foreground mb-1.5">
                    Entrar em um workspace
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                    Use um código de convite recebido de alguém da sua equipe. Seu
                    cargo será definido automaticamente pelo convite.
                  </p>
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary group-hover:gap-2.5 transition-all">
                    Entrar com código <ArrowRight className="h-4 w-4" />
                  </span>
                </button>
              </div>
            </div>
          )}

          {mode === "create" && (
            <div className="max-w-md mx-auto">
              <button
                onClick={() => setMode("choose")}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar
              </button>
              <div className="space-y-2 mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Crie seu workspace</h1>
                <p className="text-sm text-muted-foreground">
                  Esse será o espaço principal da sua empresa ou equipe.
                </p>
              </div>
              <form onSubmit={onCreate} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="ws-name">Nome do workspace</Label>
                  <Input
                    id="ws-name"
                    value={name}
                    onChange={(e) => setName(e.target.value.slice(0, 60))}
                    placeholder="Minha empresa"
                    autoFocus
                    maxLength={60}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy || !name.trim()}>
                  {busy ? "Criando..." : "Criar workspace"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Você será definido automaticamente como Owner deste workspace.
                </p>
              </form>
            </div>
          )}

          {mode === "join" && (
            <div className="max-w-md mx-auto">
              <button
                onClick={() => setMode("choose")}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar
              </button>
              <div className="space-y-2 mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Entrar com código</h1>
                <p className="text-sm text-muted-foreground">
                  Digite o código de convite enviado por alguém da sua equipe.
                </p>
              </div>
              <form onSubmit={onJoin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="ws-code">Código de convite</Label>
                  <Input
                    id="ws-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 20))}
                    placeholder="BUZZ-XXXXXX"
                    autoFocus
                    maxLength={20}
                    className="font-mono tracking-wider uppercase"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy || !code.trim()}>
                  {busy ? "Verificando..." : "Entrar no workspace"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Seu cargo (admin ou member) será definido automaticamente pelo convite.
                </p>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}