import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Check, X, Copy, MailPlus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

type JoinReq = { id: string; user_id: string; display_name: string; email: string; status: string; requested_at: string };

export default function MembersPage() {
  const { workspaceId, role: myRole, myWorkspaces } = useAuth();
  const [requests, setRequests] = useState<JoinReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [approveFor, setApproveFor] = useState<JoinReq | null>(null);
  const [approveRole, setApproveRole] = useState<"admin" | "member">("member");
  const [confirm, setConfirm] = useState<null | { title: string; description: string; onConfirm: () => void | Promise<void> }>(null);

  const isOwner = myRole === "owner";
  const wsCode = myWorkspaces.find(w => w.workspace_id === workspaceId)?.code || "";

  const load = useCallback(async () => {
    if (!workspaceId || !isOwner) { setRequests([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await (supabase.rpc as any)("list_workspace_join_requests", { _ws_id: workspaceId });
    setRequests(((data as any[]) || []) as JoinReq[]);
    setLoading(false);
  }, [workspaceId, isOwner]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!workspaceId || !isOwner) return;
    let initialLoadDone = false;
    load().then(() => { initialLoadDone = true; });

    let ch: ReturnType<typeof supabase.channel> | null = null;
    try {
      ch = supabase
        .channel(`convites-${workspaceId}-${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "workspace_join_requests", filter: `workspace_id=eq.${workspaceId}` }, (payload) => {
          if (initialLoadDone) {
            const name = (payload.new as any)?.display_name || "Alguém";
            toast.info(`Novo convite de ${name}`, { description: "Aprovação pendente em Convites.", duration: 5000 });
          }
          load();
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "workspace_join_requests", filter: `workspace_id=eq.${workspaceId}` }, () => load())
        .on("postgres_changes", { event: "DELETE", schema: "public", table: "workspace_join_requests", filter: `workspace_id=eq.${workspaceId}` }, () => load())
        .subscribe();
    } catch { ch = null; }
    return () => { if (ch) supabase.removeChannel(ch); };
  }, [workspaceId, load, isOwner]);

  const copyCode = async () => {
    if (!wsCode) return;
    try { await navigator.clipboard.writeText(wsCode); toast.success("Código copiado!"); }
    catch { toast.error("Falha ao copiar."); }
  };

  const approve = async () => {
    if (!approveFor) return;
    const { error } = await (supabase.rpc as any)("approve_join_request", { _req_id: approveFor.id, _role: approveRole });
    if (error) { toast.error("Falha ao aprovar."); return; }
    toast.success("Convite aprovado!");
    setApproveFor(null);
    await load();
  };

  const reject = async (r: JoinReq) => {
    const { error } = await (supabase.rpc as any)("reject_join_request", { _req_id: r.id });
    if (error) { toast.error("Falha ao recusar."); return; }
    toast.success("Convite recusado.");
    await load();
  };

  const fmtDate = (s: string) => new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Convites</h1>
          <p className="text-sm text-muted-foreground">Pedidos de entrada no workspace — aprove ou recuse.</p>
        </div>
        {wsCode && (
          <Button variant="outline" onClick={copyCode} title="Código de convite do workspace">
            <Copy className="h-4 w-4 mr-1" /> {wsCode}
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : !isOwner ? (
        <div className="bg-card border border-border rounded-lg p-10 text-center">
          <MailPlus className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Só o owner do workspace vê e aprova os convites de entrada.</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-10 text-center">
          <MailPlus className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum convite pendente.</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Aparece aqui quando alguém pede para entrar com o código do workspace.</p>
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
                  title: "Recusar convite?",
                  description: `${r.display_name} não terá acesso ao workspace.`,
                  onConfirm: () => reject(r),
                })}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!approveFor} onOpenChange={(o) => { if (!o) setApproveFor(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Aprovar {approveFor?.display_name}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Escolha o cargo no workspace:</p>
          <div className="flex gap-2">
            <Button variant={approveRole === "member" ? "default" : "outline"} className="flex-1" onClick={() => setApproveRole("member")}>Assessor</Button>
            <Button variant={approveRole === "admin" ? "default" : "outline"} className="flex-1" onClick={() => setApproveRole("admin")}>Diretor</Button>
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
