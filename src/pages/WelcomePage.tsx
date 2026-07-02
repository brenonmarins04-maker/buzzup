import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthTransition } from "@/contexts/AuthTransitionContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trackPlatformEvent } from "@/lib/platformAnalytics";
import BrandLogo from "@/components/BrandLogo";
import { toast } from "sonner";
import {
  KeyRound, ArrowRight, ArrowLeft, LogOut, Building2,
  Clock, CheckCircle2, XCircle, Crown, Shield, User as UserIcon,
  Plus, X, Trash2, RotateCcw,
} from "lucide-react";

export default function WelcomePage() {
  const {
    user, loading, displayName,
    myWorkspaces, trashedWorkspaces, myJoinRequests,
    setActiveWorkspaceId,
    createWorkspace, requestJoinWorkspace, cancelJoinRequest,
    trashWorkspace, restoreWorkspace,
    signOut,
  } = useAuth();
  const navigate = useNavigate();
  const { setLeaving: setGlobalLeaving } = useAuthTransition();
  const [mode, setMode] = useState<"hub" | "create" | "join">("hub");
  const [wsName, setWsName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Stagger trigger: fires shortly after AnimatePresence mounts this component
  const [contentIn, setContentIn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setContentIn(true), 40);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [loading, user, navigate]);

  const enterWorkspace = async (id: string) => {
    trackPlatformEvent("workspace_entered", {
      email: user?.email,
      metadata: { workspace_id: id },
    });
    // Trigger exit animations on cards + panel morph
    setLeaving(true);
    setGlobalLeaving(true);
    await new Promise(r => setTimeout(r, 400));
    // Reset global leaving after AuthLayout unmounts (no visual effect)
    setTimeout(() => setGlobalLeaving(false), 200);
    flushSync(() => { setActiveWorkspaceId(id); });
    navigate("/", { replace: true });
  };

  const daysLeft = (iso: string) =>
    Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));

  const onTrashWorkspace = async (workspaceId: string, name: string) => {
    if (!window.confirm(`Mover "${name}" para a lixeira? Ele sumirá após 14 dias.`)) return;
    const r = await trashWorkspace(workspaceId);
    if (r.ok) toast.success("Workspace movido para a lixeira.");
    else toast.error(r.error || "Não foi possível mover para a lixeira.");
  };

  const onRestoreWorkspace = async (id: string) => {
    const r = await restoreWorkspace(id);
    if (r.ok) toast.success("Workspace restaurado.");
    else toast.error(r.error || "Não foi possível restaurar.");
  };

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsName.trim() || busy) return;
    setBusy(true);
    const { ok, error, workspace } = await createWorkspace(wsName.trim());
    setBusy(false);
    if (ok) {
      trackPlatformEvent("workspace_created", {
        email: user?.email,
        metadata: {
          workspace_id: workspace?.id ?? null,
          workspace_name: wsName.trim(),
        },
      });
      toast.success("Workspace criado!");
      if (workspace?.id) setActiveWorkspaceId(workspace.id);
      navigate("/", { replace: true });
    } else toast.error(error || "Erro ao criar workspace");
  };

  const onJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    const result = await requestJoinWorkspace(code.trim().toUpperCase());
    setBusy(false);
    if (result.ok) {
      trackPlatformEvent("workspace_join_requested", {
        email: user?.email,
        metadata: { code: code.trim().toUpperCase() },
      });
      toast.success("Pedido enviado!");
      setCode(""); setMode("hub");
    } else toast.error(result.error || "Código inválido");
  };

  const pendingRequests = myJoinRequests.filter(r => r.status === "pending");
  const otherRequests = myJoinRequests.filter(r => r.status !== "pending").slice(0, 5);

  const roleIcon = (r: string) =>
    r === "owner" ? <Crown className="h-3.5 w-3.5" /> :
    r === "admin" ? <Shield className="h-3.5 w-3.5" /> :
    <UserIcon className="h-3.5 w-3.5" />;

  // Staggered fade-up helper — delays grow by 65ms per item index
  // When leaving: all items fade out quickly (no stagger)
  const fadeUp = (i: number): React.CSSProperties => {
    if (leaving) return {
      opacity: 0,
      transform: "translateY(8px)",
      transition: "opacity 0.2s ease-in, transform 0.2s ease-in",
      pointerEvents: "none",
    };
    return {
      opacity: contentIn ? 1 : 0,
      transform: contentIn ? "translateY(0)" : "translateY(12px)",
      transition: `opacity 0.28s ease-out ${i * 65}ms, transform 0.28s ease-out ${i * 65}ms`,
    };
  };

  const firstName = displayName?.split(" ")[0] ?? "";

  return (
    <div className="min-h-full bg-[#f7f7f5]">

      {/* Mobile header — blue panel is hidden on small screens */}
      <div className="lg:hidden flex items-center justify-between px-5 py-3.5 bg-white border-b border-border/40 sticky top-0 z-10">
        <Link to="/home" className="font-extrabold tracking-tight text-foreground transition-opacity hover:opacity-80" aria-label="Voltar para a home do BuzzUp">
          <BrandLogo markClassName="h-8 w-8" textClassName="text-base text-foreground" />
        </Link>
        <button onClick={() => signOut()} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <LogOut className="h-3.5 w-3.5" /> Sair
        </button>
      </div>

      {/* Mobile greeting */}
      <div className="lg:hidden px-5 pt-7 pb-2">
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
          Olá{firstName ? `, ${firstName}` : ""}!
        </h1>
        {user?.email && <p className="text-sm text-muted-foreground mt-1">{user.email}</p>}
      </div>

      <div className="px-8 py-8 lg:py-10">

        {/* ── HUB ── */}
        {mode === "hub" && (
          <div className="space-y-8">

            {/* Label */}
            <div style={fadeUp(0)} className="flex items-center gap-3">
              <h2 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                Meus Workspaces
              </h2>
              <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5 leading-none font-semibold">
                {myWorkspaces.length}
              </span>
            </div>

            {/* Workspace cards */}
            {myWorkspaces.length === 0 ? (
              <div style={fadeUp(1)} className="rounded-3xl border border-dashed border-border bg-white p-10 text-center">
                <Building2 className="h-10 w-10 text-muted-foreground/25 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Você ainda não participa de nenhum workspace.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {myWorkspaces.map((w, i) => (
                  <div
                    key={w.workspace_id}
                    onClick={() => enterWorkspace(w.workspace_id)}
                    style={fadeUp(i + 1)}
                    className="group relative text-left rounded-3xl border border-border/50 bg-white p-6 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/8 transition-[border-color,box-shadow] cursor-pointer flex items-center gap-4"
                  >
                    <div className="h-14 w-14 rounded-2xl bg-primary/8 text-primary flex items-center justify-center shrink-0">
                      <Building2 className="h-7 w-7" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-foreground truncate text-base">{w.name}</div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/8 text-primary font-bold">
                          {roleIcon(w.role)} {w.role}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">{w.code}</span>
                      </div>
                    </div>
                    {w.role === "owner" ? (
                      <button
                        type="button"
                        title="Mover para lixeira"
                        onClick={e => { e.stopPropagation(); onTrashWorkspace(w.workspace_id, w.name); }}
                        className="opacity-0 group-hover:opacity-100 p-2 rounded-xl text-muted-foreground/40 hover:text-destructive hover:bg-destructive/8 transition-all shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <ArrowRight className="h-5 w-5 text-muted-foreground/25 group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Pedidos pendentes */}
            {pendingRequests.length > 0 && (
              <section style={fadeUp(myWorkspaces.length + 1)}>
                <h2 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Pedidos pendentes</h2>
                <div className="space-y-2">
                  {pendingRequests.map(r => (
                    <div key={r.id} className="rounded-2xl border border-amber-200/80 bg-amber-50 p-4 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                        <Clock className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-foreground text-sm truncate">{r.workspace_name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{r.workspace_code} · aguardando</div>
                      </div>
                      <button onClick={async () => {
                        const { ok, error } = await cancelJoinRequest(r.id);
                        if (ok) toast.success("Pedido cancelado"); else toast.error(error || "Erro");
                      }} className="text-xs text-muted-foreground hover:text-destructive transition-colors shrink-0">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Histórico */}
            {otherRequests.length > 0 && (
              <section style={fadeUp(myWorkspaces.length + 2)}>
                <h2 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Histórico</h2>
                <div className="space-y-0.5">
                  {otherRequests.map(r => (
                    <div key={r.id} className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-muted/40 transition-colors">
                      {r.status === "approved" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> :
                        r.status === "rejected" ? <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" /> :
                          <X className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />}
                      <span className="flex-1 truncate text-sm text-foreground/80">{r.workspace_name}</span>
                      <span className="text-[10px] text-muted-foreground capitalize shrink-0">
                        {r.status === "approved" ? "aprovado" : r.status === "rejected" ? "recusado" : "cancelado"}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Ações */}
            <div className="grid sm:grid-cols-2 gap-3">
              <button
                onClick={() => setMode("join")}
                style={fadeUp(myWorkspaces.length + 1)}
                className="group text-left rounded-3xl border border-border/50 bg-white p-6 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/8 transition-[border-color,box-shadow] flex items-center gap-4"
              >
                <div className="h-12 w-12 rounded-2xl bg-primary/8 text-primary flex items-center justify-center shrink-0">
                  <KeyRound className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-foreground text-base">Entrar com código</div>
                  <div className="text-sm text-muted-foreground mt-0.5">Pedir acesso a um workspace</div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground/25 group-hover:text-primary shrink-0 transition-colors" />
              </button>

              <button
                onClick={() => setMode("create")}
                style={fadeUp(myWorkspaces.length + 2)}
                className="group text-left rounded-3xl bg-primary p-6 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/25 transition-all flex items-center gap-4"
              >
                <div className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                  <Plus className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white text-base">Criar workspace</div>
                  <div className="text-sm text-white/65 mt-0.5">Você será o owner</div>
                </div>
                <ArrowRight className="h-5 w-5 text-white/50 group-hover:text-white shrink-0 transition-colors" />
              </button>
            </div>

            {/* Lixeira — discreta */}
            {trashedWorkspaces.length > 0 && (
              <section style={fadeUp(myWorkspaces.length + 3)} className="pt-2 border-t border-border/30">
                <details>
                  <summary className="flex items-center gap-2 text-[11px] text-muted-foreground/45 hover:text-muted-foreground cursor-pointer select-none list-none transition-colors">
                    <Trash2 className="h-3 w-3" />
                    Lixeira
                    <span className="bg-muted rounded-full px-1.5 py-0.5 leading-none">{trashedWorkspaces.length}</span>
                  </summary>
                  <div className="mt-3 space-y-1.5">
                    {trashedWorkspaces.map(w => (
                      <div key={w.workspace_id} className="flex items-center gap-2 py-1.5 px-2 rounded-xl hover:bg-muted/40 transition-colors">
                        <span className="flex-1 text-xs text-muted-foreground/60 truncate">{w.name}</span>
                        <span className="text-[10px] text-muted-foreground/40 shrink-0">Some em {daysLeft(w.delete_after)}d</span>
                        <button onClick={() => onRestoreWorkspace(w.workspace_id)} className="text-[10px] text-primary hover:text-primary/80 font-semibold shrink-0 flex items-center gap-0.5 transition-colors">
                          <RotateCcw className="h-2.5 w-2.5" /> Restaurar
                        </button>
                      </div>
                    ))}
                  </div>
                </details>
              </section>
            )}
          </div>
        )}

        {/* ── CRIAR WORKSPACE ── */}
        {mode === "create" && (
          <div className="max-w-sm">
            <button onClick={() => setMode("hub")} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-7 transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </button>
            <div className="mb-7">
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Criar workspace</h1>
              <p className="text-sm text-muted-foreground mt-2">Esse será o espaço principal da sua empresa ou time.</p>
            </div>
            <form onSubmit={onCreate} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="ws-name" className="font-semibold text-sm">Nome do workspace</Label>
                <Input id="ws-name" value={wsName} onChange={e => setWsName(e.target.value.slice(0, 60))} placeholder="Minha empresa" autoFocus maxLength={60} className="h-12 rounded-2xl text-sm bg-white" />
              </div>
              <Button type="submit" className="w-full h-12 rounded-2xl font-bold text-sm" disabled={busy || !wsName.trim()}>
                {busy ? "Criando..." : "Criar workspace"}{!busy && <ArrowRight className="h-4 w-4 ml-2" />}
              </Button>
              <p className="text-xs text-muted-foreground text-center">Você será definido automaticamente como Owner.</p>
            </form>
          </div>
        )}

        {/* ── ENTRAR COM CÓDIGO ── */}
        {mode === "join" && (
          <div className="max-w-sm">
            <button onClick={() => setMode("hub")} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-7 transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </button>
            <div className="mb-7">
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Entrar com código</h1>
              <p className="text-sm text-muted-foreground mt-2">Digite o código de convite enviado por alguém do time.</p>
            </div>
            <form onSubmit={onJoin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="ws-code" className="font-semibold text-sm">Código de convite</Label>
                <Input id="ws-code" value={code} onChange={e => setCode(e.target.value.toUpperCase().slice(0, 20))} placeholder="BUZZ-XXXXXX" autoFocus maxLength={20} className="h-12 rounded-2xl font-mono tracking-wider uppercase text-sm bg-white" />
              </div>
              <Button type="submit" className="w-full h-12 rounded-2xl font-bold text-sm" disabled={busy || !code.trim()}>
                {busy ? "Verificando..." : "Pedir acesso"}{!busy && <ArrowRight className="h-4 w-4 ml-2" />}
              </Button>
              <p className="text-xs text-muted-foreground text-center">Seu cargo será definido pelo owner ao aprovar.</p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
