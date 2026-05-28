import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Trash2, ArrowUp, ArrowDown, Shield, Crown, Eye, Check, X, Copy } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

type Role = "owner" | "admin" | "member";
type Member = { user_id: string; role: Role; created_at: string; display_name: string };
type JoinReq = { id: string; user_id: string; display_name: string; email: string; status: string; requested_at: string };

export default function MembersPage() {
  const { user, workspaceId, role: myRole, myWorkspaces } = useAuth();
  const [tab, setTab] = useState<"members" | "requests">("members");
  const [members, setMembers] = useState<Member[]>([]);
  const [requests, setRequests] = useState<JoinReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [approveFor, setApproveFor] = useState<JoinReq | null>(null);
  const [approveRole, setApproveRole] = useState<"admin" | "member">("member");
  const [confirm, setConfirm] = useState<null | { title: string; description: string; onConfirm: () => void | Promise<void> }>(null);

  const isOwner = myRole === "owner";
  const isAdmin = myRole === "admin";
  const wsCode = myWorkspaces.find(w => w.workspace_id === workspaceId)?.code || "";

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const [mRes, rRes] = await Promise.all([
      (supabase.rpc as any)("list_workspace_members", { _ws_id: workspaceId }),
      isOwner
        ? (supabase.rpc as any)("list_workspace_join_requests", { _ws_id: workspaceId })
        : Promise.resolve({ data: [] as any[] }),
    ]);
    setMembers(((mRes.data as any[]) || []).map((m: any) => ({
      user_id: m.user_id, role: m.role, created_at: m.created_at,
      display_name: m.display_name || m.email || "Usuário",
    })));
    setRequests(((rRes.data as any[]) || []) as JoinReq[]);
    setLoading(false);
  }, [workspaceId, isOwner]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!workspaceId) return;
    const ch = supabase
      .channel(`members-${workspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "workspace_join_requests", filter: `workspace_id=eq.${workspaceId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "workspace_members", filter: `workspace_id=eq.${workspaceId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [workspaceId, load]);

  const copyCode = async () => {
    if (!wsCode) return;
    try { await navigator.clipboard.writeText(wsCode); toast.success("Código copiado!"); }
    catch { toast.error("Falha ao copiar."); }
  };

  const approve = async () => {
    if (!approveFor) return;
    const { error } = await (supabase.rpc as any)("approve_join_request", { _req_id: approveFor.id, _role: approveRole });
    if (error) { toast.error("Falha ao aprovar."); return; }
    toast.success("Pedido aprovado!");
    setApproveFor(null);
    await load();
  };

  const reject = async (r: JoinReq) => {
    const { error } = await (supabase.rpc as any)("reject_join_request", { _req_id: r.id });
    if (error) { toast.error("Falha ao rejeitar."); return; }
    toast.success("Pedido rejeitado.");
    await load();
  };

  const updateRole = async (m: Member, newRole: "admin" | "member") => {
    if (!workspaceId) return;
    const { error } = await (supabase.rpc as any)("update_member_role", {
      _ws_id: workspaceId, _target: m.user_id, _new_role: newRole,
    });
    if (error) { toast.error("Falha ao alterar cargo."); return; }
    toast.success(newRole === "admin" ? "Promovido a admin." : "Rebaixado para member.");
    await load();
  };

  const removeMember = async (m: Member) => {
    if (!workspaceId) return;
    const { error } = await (supabase.rpc as any)("remove_workspace_member", {
      _ws_id: workspaceId, _target: m.user_id,
    });
    if (error) { toast.error("Falha ao remover."); return; }
    toast.success("Membro removido.");
    await load();
  };

  const roleBadge = (r: Role) => {
    const Icon = r === "owner" ? Crown : r === "admin" ? Shield : Eye;
    const label = r === "owner" ? "Owner" : r === "admin" ? "Admin" : "Member";
    const cls = r === "owner"
      ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
      : r === "admin" ? "bg-primary/10 text-primary border-primary/20"
      : "bg-muted text-muted-foreground border-border";
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}>
        <Icon className="h-3 w-3" /> {label}
      </span>
    );
  };

  const fmtDate = (s: string) => new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Membros e Convites</h1>
          <p className="text-sm text-muted-foreground">Gerencie quem tem acesso ao workspace.</p>
        </div>
        {wsCode && (
          <Button variant="outline" onClick={copyCode}>
            <Copy className="h-4 w-4 mr-1" /> {wsCode}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-1 border-b border-border">
        {[
          { v: "members" as const, label: `Membros (${members.length})` },
          ...(isOwner ? [{ v: "requests" as const, label: `Pedidos (${requests.length})` }] : []),
        ].map(t => (
          <button key={t.v} onClick={() => setTab(t.v)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t.v ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : tab === "members" ? (
        <div className="bg-card border border-border rounded-lg divide-y divide-border">
          {members.map(m => {
            const isMe = m.user_id === user?.id;
            const canActOnMember = isOwner && m.role !== "owner";
            const canRemoveAsAdmin = isAdmin && !isOwner && m.role === "member";
            const canPromote = isOwner && m.role === "member";
            const canDemote = isOwner && m.role === "admin";
            const canRemove = canActOnMember || canRemoveAsAdmin;
            return (
              <div key={m.user_id} className="flex items-center gap-3 px-4 py-3">
                <div className="h-9 w-9 rounded-full bg-accent flex items-center justify-center text-xs font-semibold shrink-0">
                  {(m.display_name || "?").split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground truncate">
                      {m.display_name}{isMe && <span className="text-muted-foreground"> (você)</span>}
                    </span>
                    {roleBadge(m.role)}
                  </div>
                  <span className="text-[11px] text-muted-foreground">Entrou em {fmtDate(m.created_at)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {canPromote && (
                    <Button size="sm" variant="outline" onClick={() => setConfirm({
                      title: "Promover a admin?",
                      description: `${m.display_name} terá acesso administrativo.`,
                      onConfirm: () => updateRole(m, "admin"),
                    })}>
                      <ArrowUp className="h-3.5 w-3.5 mr-1" /> Promover
                    </Button>
                  )}
                  {canDemote && (
                    <Button size="sm" variant="outline" onClick={() => setConfirm({
                      title: "Rebaixar para member?",
                      description: `${m.display_name} perderá acesso administrativo.`,
                      onConfirm: () => updateRole(m, "member"),
                    })}>
                      <ArrowDown className="h-3.5 w-3.5 mr-1" /> Rebaixar
                    </Button>
                  )}
                  {canRemove && !isMe && (
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                      onClick={() => setConfirm({
                        title: "Remover do workspace?",
                        description: `${m.display_name} perderá acesso a todos os dados.`,
                        onConfirm: () => removeMember(m),
                      })}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {members.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhum membro.</p>}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg divide-y divide-border">
          {requests.map(r => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground">{r.display_name}</div>
                <div className="text-[11px] text-muted-foreground">{r.email} · pediu em {fmtDate(r.requested_at)}</div>
              </div>
              <Button size="sm" onClick={() => { setApproveRole("member"); setApproveFor(r); }}>
                <Check className="h-3.5 w-3.5 mr-1" /> Aprovar
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                onClick={() => setConfirm({
                  title: "Rejeitar pedido?",
                  description: `${r.display_name} não terá acesso ao workspace.`,
                  onConfirm: () => reject(r),
                })}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {requests.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhum pedido pendente.</p>}
        </div>
      )}

      <Dialog open={!!approveFor} onOpenChange={(o) => { if (!o) setApproveFor(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Aprovar {approveFor?.display_name}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Escolha o cargo no workspace:</p>
          <div className="flex gap-2">
            <Button variant={approveRole === "member" ? "default" : "outline"} className="flex-1" onClick={() => setApproveRole("member")}>Member</Button>
            <Button variant={approveRole === "admin" ? "default" : "outline"} className="flex-1" onClick={() => setApproveRole("admin")}>Admin</Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveFor(null)}>Cancelar</Button>
            <Button onClick={approve}>Aprovar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirm} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{confirm?.title}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{confirm?.description}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={async () => { await confirm?.onConfirm(); setConfirm(null); }}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
