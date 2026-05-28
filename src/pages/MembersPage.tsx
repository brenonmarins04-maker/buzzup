import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, ArrowUp, ArrowDown, Copy, Check, Shield, Crown, Eye, X } from "lucide-react";
import { toast } from "sonner";
import CreateInviteModal from "@/components/modals/CreateInviteModal";
import InviteCodeDialog from "@/components/modals/InviteCodeDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

type Role = "owner" | "admin" | "member";
type Member = { user_id: string; role: Role; created_at: string; display_name: string };
type Invite = {
  id: string; role: Role; status: string; created_at: string; expires_at: string;
  max_uses: number; used_count: number; created_by: string | null; created_by_name?: string;
};

export default function MembersPage() {
  const { user, workspaceId, role: myRole } = useAuth();
  const [tab, setTab] = useState<"members" | "invites">("members");
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [codeDialog, setCodeDialog] = useState<{ open: boolean; code: string; role: "admin" | "member" }>({ open: false, code: "", role: "member" });
  const [confirm, setConfirm] = useState<null | { title: string; description: string; onConfirm: () => void | Promise<void> }>(null);

  const isOwner = myRole === "owner";
  const isAdmin = myRole === "admin";
  const canCreate = isOwner || isAdmin;

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const [mRes, iRes] = await Promise.all([
      supabase
        .from("workspace_members")
        .select("user_id, role, created_at")
        .eq("workspace_id", workspaceId)
        .eq("status", "active"),
      (isOwner || isAdmin)
        ? supabase
            .from("workspace_invites")
            .select("id, role, status, created_at, expires_at, max_uses, used_count, created_by")
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] }) as any,
    ]);
    const memRows = (mRes.data || []) as any[];
    const inviteRows = (iRes.data || []) as any[];
    const userIds = Array.from(new Set([
      ...memRows.map(m => m.user_id),
      ...inviteRows.map(i => i.created_by).filter(Boolean),
    ]));
    let profilesMap = new Map<string, string>();
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);
      profilesMap = new Map((profs || []).map((p: any) => [p.user_id, p.display_name || ""]));
    }
    setMembers(memRows.map((m: any) => ({
      user_id: m.user_id, role: m.role, created_at: m.created_at,
      display_name: profilesMap.get(m.user_id) || "Usuário",
    })));
    setInvites(inviteRows.map((i: any) => ({
      ...i,
      created_by_name: i.created_by ? (profilesMap.get(i.created_by) || "—") : "—",
    })));
    setLoading(false);
  }, [workspaceId, isOwner, isAdmin]);

  useEffect(() => { load(); }, [load]);

  const ownerCount = useMemo(() => members.filter(m => m.role === "owner").length, [members]);

  const onCreateInvite = async (role: "admin" | "member", expiresInHours: number, maxUses: number) => {
    if (!workspaceId) return;
    const { data, error } = await (supabase.rpc as any)("create_workspace_invite", {
      _workspace_id: workspaceId, _role: role, _expires_in_hours: expiresInHours, _max_uses: maxUses,
    });
    if (error) {
      const m = String(error.message || "").toLowerCase();
      if (m.includes("only_owner_invites_admin")) toast.error("Apenas o owner pode convidar admins.");
      else if (m.includes("forbidden")) toast.error("Você não tem permissão.");
      else toast.error("Falha ao gerar convite.");
      return;
    }
    const code = String(data || "");
    setCreateOpen(false);
    setCodeDialog({ open: true, code, role });
    await load();
  };

  const revoke = async (inv: Invite) => {
    if (!workspaceId) return;
    const { error } = await (supabase.rpc as any)("revoke_workspace_invite", {
      _workspace_id: workspaceId, _invite_id: inv.id,
    });
    if (error) { toast.error("Falha ao revogar."); return; }
    toast.success("Convite revogado.");
    await load();
  };

  const updateRole = async (m: Member, newRole: "admin" | "member") => {
    if (!workspaceId) return;
    const { error } = await (supabase.rpc as any)("update_member_role", {
      _workspace_id: workspaceId, _target_user: m.user_id, _new_role: newRole,
    });
    if (error) {
      const msg = String(error.message || "").toLowerCase();
      if (msg.includes("forbidden")) toast.error("Sem permissão.");
      else if (msg.includes("cannot_change_owner")) toast.error("Não é possível alterar owner.");
      else toast.error("Falha ao alterar cargo.");
      return;
    }
    toast.success(newRole === "admin" ? "Promovido a admin." : "Rebaixado para member.");
    await load();
  };

  const removeMember = async (m: Member) => {
    if (!workspaceId) return;
    const { error } = await (supabase.rpc as any)("remove_workspace_member", {
      _workspace_id: workspaceId, _target_user: m.user_id,
    });
    if (error) {
      const msg = String(error.message || "").toLowerCase();
      if (msg.includes("cannot_remove_owner")) toast.error("Não é possível remover owner.");
      else if (msg.includes("forbidden")) toast.error("Sem permissão.");
      else toast.error("Falha ao remover.");
      return;
    }
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

  const inviteStatus = (i: Invite) => {
    const expired = new Date(i.expires_at).getTime() < Date.now();
    if (i.status === "revoked") return { label: "Revogado", cls: "bg-destructive/10 text-destructive" };
    if (i.status === "used" || i.used_count >= i.max_uses) return { label: "Usado", cls: "bg-muted text-muted-foreground" };
    if (expired) return { label: "Expirado", cls: "bg-muted text-muted-foreground" };
    return { label: "Ativo", cls: "bg-emerald-500/10 text-emerald-600" };
  };

  const fmtDate = (s: string) => new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Membros e Convites</h1>
          <p className="text-sm text-muted-foreground">Gerencie quem tem acesso ao workspace.</p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Gerar convite
          </Button>
        )}
      </div>

      <div className="flex items-center gap-1 border-b border-border">
        {[
          { v: "members" as const, label: `Membros (${members.length})` },
          ...(canCreate ? [{ v: "invites" as const, label: `Convites (${invites.length})` }] : []),
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
            const canRemoveAsAdmin = isAdmin && m.role === "member";
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
          {invites.map(i => {
            const st = inviteStatus(i);
            const canRevoke = i.status === "active" && (isOwner || (isAdmin && i.role === "member" && i.created_by === user?.id));
            return (
              <div key={i.id} className="flex items-center gap-3 px-4 py-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {roleBadge(i.role)}
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
                    <span className="text-[11px] text-muted-foreground">{i.used_count}/{i.max_uses} usos</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Criado por {i.created_by_name} · {fmtDate(i.created_at)} · expira {fmtDate(i.expires_at)}
                  </div>
                </div>
                {canRevoke && (
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                    onClick={() => setConfirm({
                      title: "Revogar convite?",
                      description: "O código deixará de funcionar imediatamente.",
                      onConfirm: () => revoke(i),
                    })}>
                    <X className="h-3.5 w-3.5 mr-1" /> Revogar
                  </Button>
                )}
              </div>
            );
          })}
          {invites.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhum convite.</p>}
        </div>
      )}

      <CreateInviteModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        canInviteAdmin={isOwner}
        onSubmit={onCreateInvite}
      />

      <InviteCodeDialog
        open={codeDialog.open}
        onOpenChange={(o) => setCodeDialog(s => ({ ...s, open: o }))}
        code={codeDialog.code}
        role={codeDialog.role}
      />

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
