import { useMemo, useState } from "react";
import { useData, type WorkspaceForm, type WorkspaceFormTarget } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FileText, Plus, ExternalLink, CheckCircle2, Trash2, Users, UsersRound, Globe } from "lucide-react";
import { toast } from "sonner";
import { AREAS, getAreaLabel } from "@/lib/areas";

export default function FormsSection() {
  const { forms, formCompletions, teams, people, addForm, deleteForm, markFormCompleted } = useData();
  const { user, isAdmin } = useAuth();

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [targetType, setTargetType] = useState<WorkspaceFormTarget>("all");
  const [targetValue, setTargetValue] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<WorkspaceForm | null>(null);

  // Pessoas vinculadas ao usuário atual → áreas e times dele
  const { myAreas, myTeamIds } = useMemo(() => {
    if (!user) return { myAreas: new Set<string>(), myTeamIds: new Set<string>() };
    const myPersonIds = new Set(people.filter(p => p.userId === user.id).map(p => p.id));
    const areas = new Set<string>();
    people.filter(p => myPersonIds.has(p.id)).forEach(p => (p.areas || []).forEach(a => areas.add(a)));
    const teamIds = new Set(teams.filter(t => t.memberIds.some(id => myPersonIds.has(id))).map(t => t.id));
    return { myAreas: areas, myTeamIds: teamIds };
  }, [user, people, teams]);

  const completedByMe = useMemo(
    () => new Set(formCompletions.filter(c => c.userId === user?.id).map(c => c.formId)),
    [formCompletions, user?.id]
  );

  const isEligible = (f: WorkspaceForm) => {
    if (f.targetType === "all") return true;
    if (f.targetType === "area") return !!f.targetValue && myAreas.has(f.targetValue);
    if (f.targetType === "team") return !!f.targetValue && myTeamIds.has(f.targetValue);
    return false;
  };

  // Formulários pendentes para mim (elegível e ainda não preenchido)
  const myPending = forms.filter(f => isEligible(f) && !completedByMe.has(f.id));

  // Nada para mostrar: membro sem pendências e sem permissão de admin
  if (!isAdmin && myPending.length === 0) return null;

  const targetLabel = (f: WorkspaceForm) => {
    if (f.targetType === "area") return getAreaLabel(f.targetValue || "");
    if (f.targetType === "team") return teams.find(t => t.id === f.targetValue)?.name || "Time";
    return "Todos";
  };
  const TargetIcon = (f: WorkspaceForm) =>
    f.targetType === "area" ? <Users className="h-3 w-3" /> :
    f.targetType === "team" ? <UsersRound className="h-3 w-3" /> :
    <Globe className="h-3 w-3" />;

  const completionCount = (formId: string) => formCompletions.filter(c => c.formId === formId).length;

  const resetModal = () => {
    setTitle(""); setUrl(""); setDescription(""); setTargetType("all"); setTargetValue("");
  };

  const onCreate = async () => {
    if (!title.trim() || !url.trim() || busy) return;
    if (targetType !== "all" && !targetValue) {
      toast.error(targetType === "area" ? "Escolha a área" : "Escolha o time");
      return;
    }
    let finalUrl = url.trim();
    if (!/^https?:\/\//i.test(finalUrl)) finalUrl = `https://${finalUrl}`;
    setBusy(true);
    await addForm(title.trim(), finalUrl, targetType, targetType === "all" ? null : targetValue, description.trim());
    setBusy(false);
    toast.success("Formulário publicado!");
    resetModal();
    setCreateOpen(false);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <FileText className="h-4 w-4 text-[#8B5CF6]" /> Formulários
        </h2>
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Novo formulário
          </Button>
        )}
      </div>

      {/* Meus formulários pendentes */}
      {myPending.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum formulário pendente. 🎉</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {myPending.map(f => (
            <div key={f.id} className="flex flex-col gap-3 p-4 rounded-lg border border-[#8B5CF6]/20 bg-[#8B5CF6]/5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{f.title}</p>
                  {f.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{f.description}</p>
                  )}
                </div>
                <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#8B5CF6]/15 text-[#8B5CF6]">
                  {TargetIcon(f)} {targetLabel(f)}
                </span>
              </div>
              <div className="flex gap-2 pt-2 border-t border-border/30">
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-md bg-[#8B5CF6] text-white hover:bg-[#7C3AED] transition-all"
                >
                  <ExternalLink className="h-3 w-3" /> Abrir formulário
                </a>
                <button
                  onClick={() => { markFormCompleted(f.id); toast.success("Formulário marcado como preenchido!"); }}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-md bg-emerald-500/20 text-emerald-600 hover:bg-emerald-500/30 border border-emerald-300 transition-all"
                >
                  <CheckCircle2 className="h-3 w-3" /> Preenchido
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Gestão (admins): todos os formulários publicados + contagem de respostas */}
      {isAdmin && forms.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Publicados ({forms.length})</p>
          <ul className="space-y-1.5">
            {forms.map(f => (
              <li key={f.id} className="flex items-center gap-2.5 px-3 py-2 rounded-md bg-muted/40">
                <FileText className="h-3.5 w-3.5 text-[#8B5CF6] shrink-0" />
                <span className="flex-1 text-sm font-medium text-foreground truncate">{f.title}</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                  {TargetIcon(f)} {targetLabel(f)}
                </span>
                <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                  {completionCount(f.id)} preencheram
                </span>
                <button
                  onClick={() => setConfirmDelete(f)}
                  className="p-1 rounded text-destructive hover:bg-destructive/10 shrink-0"
                  title="Remover formulário"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Modal: novo formulário */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) { setCreateOpen(false); resetModal(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo formulário</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="form-title">Título</Label>
              <Input id="form-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex.: Pesquisa de clima" autoFocus maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="form-url">Link do formulário</Label>
              <Input id="form-url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://forms.gle/..." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="form-desc">Descrição (opcional)</Label>
              <Input id="form-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="Breve contexto" maxLength={200} />
            </div>
            <div className="space-y-1.5">
              <Label>Quem deve responder?</Label>
              <div className="flex gap-2">
                {([
                  { v: "all" as const, label: "Todos" },
                  { v: "area" as const, label: "Área" },
                  { v: "team" as const, label: "Time" },
                ]).map(opt => (
                  <Button
                    key={opt.v}
                    type="button"
                    variant={targetType === opt.v ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => { setTargetType(opt.v); setTargetValue(""); }}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
            {targetType === "area" && (
              <div className="space-y-1.5">
                <Label>Área</Label>
                <select
                  value={targetValue}
                  onChange={e => setTargetValue(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Escolha a área…</option>
                  {AREAS.map(a => <option key={a.key} value={a.key}>{getAreaLabel(a.key)}</option>)}
                </select>
              </div>
            )}
            {targetType === "team" && (
              <div className="space-y-1.5">
                <Label>Time</Label>
                <select
                  value={targetValue}
                  onChange={e => setTargetValue(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Escolha o time…</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); resetModal(); }}>Cancelar</Button>
            <Button onClick={onCreate} disabled={busy || !title.trim() || !url.trim()}>
              {busy ? "Publicando…" : "Publicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: confirmar remoção */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Remover formulário?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            "{confirmDelete?.title}" será removido para todos. As marcações de preenchido também serão apagadas.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={async () => { if (confirmDelete) await deleteForm(confirmDelete.id); setConfirmDelete(null); toast.success("Formulário removido."); }}
            >
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
