import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { KeyRound, ArrowRight, ArrowLeft, LogOut, Building2, Clock, CheckCircle2, XCircle, Crown, Shield, User as UserIcon, Plus, X } from "lucide-react";

export default function WelcomePage() {
  const {
    user, loading, displayName,
    myWorkspaces, myJoinRequests,
    setActiveWorkspaceId,
    createWorkspace, requestJoinWorkspace, cancelJoinRequest,
    signOut,
  } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"hub" | "create" | "join">("hub");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [loading, user, navigate]);

  const enterWorkspace = (id: string) => {
    setActiveWorkspaceId(id);
    navigate("/", { replace: true });
  };

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
    const result = await requestJoinWorkspace(code.trim().toUpperCase());
    setBusy(false);
    if (result.ok) {
      toast.success("Pedido enviado! Se o workspace for público, você entrará automaticamente.");
      setCode("");
      setMode("hub");
    } else toast.error(result.error || "Código inválido");
  };

  const pendingRequests = myJoinRequests.filter(r => r.status === "pending");
  const otherRequests = myJoinRequests.filter(r => r.status !== "pending").slice(0, 5);

  const roleIcon = (r: string) => r === "owner" ? <Crown className="h-3 w-3" /> : r === "admin" ? <Shield className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />;

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
          {mode === "hub" && (
            <div className="space-y-10">
              <div className="space-y-2">
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
                  Olá{displayName ? `, ${displayName.split(" ")[0]}` : ""}
                </h1>
                {user?.email && (
                  <p className="text-sm sm:text-base text-foreground/50">{user.email}</p>
                )}
                <p className="text-sm sm:text-base text-muted-foreground">
                  Escolha um workspace para entrar, acompanhe seus pedidos ou crie um novo.
                </p>
              </div>

              {/* My workspaces */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Meus workspaces</h2>
                  <span className="text-xs text-muted-foreground">{myWorkspaces.length}</span>
                </div>
                {myWorkspaces.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
                    Você ainda não participa de nenhum workspace.
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {myWorkspaces.map(w => (
                      <button
                        key={w.workspace_id}
                        onClick={() => enterWorkspace(w.workspace_id)}
                        className="group text-left rounded-xl border border-border bg-card p-4 hover:border-primary hover:shadow-md transition-all flex items-start gap-3"
                      >
                        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-foreground truncate">{w.name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {roleIcon(w.role)} {w.role}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono truncate">{w.code}</span>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all mt-1" />
                      </button>
                    ))}
                  </div>
                )}
              </section>

              {/* Pending join requests */}
              {pendingRequests.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Pedidos pendentes</h2>
                  <div className="space-y-2">
                    {pendingRequests.map(r => (
                      <div key={r.id} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                          <Clock className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground truncate">{r.workspace_name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{r.workspace_code} · aguardando aprovação</div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            const { ok, error } = await cancelJoinRequest(r.id);
                            if (ok) toast.success("Pedido cancelado");
                            else toast.error(error || "Erro");
                          }}
                        >
                          <X className="h-3.5 w-3.5 mr-1" /> Cancelar
                        </Button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Recent history */}
              {otherRequests.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Histórico</h2>
                  <div className="space-y-1.5">
                    {otherRequests.map(r => (
                      <div key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                        {r.status === "approved" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> :
                          r.status === "rejected" ? <XCircle className="h-4 w-4 text-red-500" /> :
                            <X className="h-4 w-4 text-muted-foreground" />}
                        <span className="flex-1 truncate text-foreground">{r.workspace_name}</span>
                        <span className="text-xs text-muted-foreground capitalize">{r.status === "approved" ? "aprovado" : r.status === "rejected" ? "recusado" : "cancelado"}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Actions */}
              <div className="grid sm:grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => setMode("join")}
                  className="group text-left rounded-xl border border-border bg-card p-4 hover:border-primary hover:shadow-md transition-all flex items-center gap-3"
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-foreground text-sm">Entrar em um workspace</div>
                    <div className="text-xs text-muted-foreground">Enviar pedido com código</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </button>

                <button
                  onClick={() => setMode("create")}
                  className="group text-left rounded-xl border border-border bg-card p-4 hover:border-primary hover:shadow-md transition-all flex items-center gap-3"
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Plus className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-foreground text-sm">Criar novo workspace</div>
                    <div className="text-xs text-muted-foreground">Você será o owner</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
              </div>
            </div>
          )}

          {mode === "create" && (
            <div className="max-w-md mx-auto">
              <button
                onClick={() => setMode("hub")}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar
              </button>
              <div className="space-y-2 mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Crie seu workspace</h1>
                <p className="text-sm text-muted-foreground">
                  Esse será o espaço principal da sua empresa ou time.
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
                onClick={() => setMode("hub")}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar
              </button>
              <div className="space-y-2 mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Entrar com código</h1>
                <p className="text-sm text-muted-foreground">
                  Digite o código de convite enviado por alguém da sua time.
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