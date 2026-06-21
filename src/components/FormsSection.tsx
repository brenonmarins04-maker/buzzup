import { useMemo, useState } from "react";
import { useData, type WorkspaceForm, type WorkspaceFormTarget } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FileText, Plus, ExternalLink, CheckCircle2, Trash2, Users, UsersRound, Globe, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { AREAS, getAreaLabel } from "@/lib/areas";

export default function FormsSection() {
  const { forms, formCompletions, teams, people, addForm, deleteForm, markFormCompleted, unmarkFormCompleted } = useData();
  const { user, isAdmin } = useAuth();

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [targetType, setTargetType] = useState<WorkspaceFormTarget>("all");
  const [targetValue, setTargetValue] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<WorkspaceForm | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  // Admin: popup com quem preencheu / quem falta
  const [viewResponses, setViewResponses] = useState<WorkspaceForm | null>(null);

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
  // Formulários que eu já marquei como preenchidos
  const myCompleted = forms.filter(f => isEligible(f) && completedByMe.has(f.id));

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
  const formatCompletionDate = (value?: string | null) => {
    if (!value) return "Sem horário registrado";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Sem horário registrado";
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

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
    <div className="bg-card border border-border rounded-xl p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 mb-3 md:mb-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <FileText className="h-4 w-4 text-[#8B5CF6]" /> Formulários
        </h2>
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)} className="shrink-0">
            <Plus className="h-3.5 w-3.5 mr-1" /> Novo formulário
          </Button>
        )}
      </div>

      {/* Meus formulários pendentes */}
      {myPending.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum formulário pendente. 🎉</p>
      ) : (
        <div className="grid grid-cols-1 gap-3">
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
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-md bg-red-500/15 text-red-600 hover:bg-red-500/25 border border-red-300 transition-all"
                >
                  <span aria-hidden="true">⚠️</span> Preencher
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preenchidos — setinha para expandir; dá para desfazer e voltar ao pendente */}
      {myCompleted.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowCompleted(v => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            {showCompleted ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            Preenchidos ({myCompleted.length})
          </button>
          {showCompleted && (
            <div className="mt-2 flex flex-col gap-2">
              {myCompleted.map(f => (
                <div key={f.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-emerald-300/40 bg-emerald-500/5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{f.title}</p>
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                      {TargetIcon(f)} {targetLabel(f)}
                    </span>
                  </div>
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Abrir formulário"
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent shrink-0"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <button
                    onClick={() => { unmarkFormCompleted(f.id); toast.info("Formulário voltou para pendentes."); }}
                    title="Desfazer — voltar para pendentes"
                    className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1.5 rounded-md text-emerald-700 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-300/50 shrink-0 transition-colors"
                  >
                    <CheckCircle2 className="h-3 w-3" /> Preenchido
                  </button>
                </div>
              ))}
            </div>
          )}
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
                <button
                  onClick={() => setViewResponses(f)}
                  title="Ver quem preencheu e quem falta"
                  className="text-xs font-medium text-primary hover:underline whitespace-nowrap shrink-0"
                >
                  {completionCount(f.id)} preencheram
                </button>
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

      {/* Modal: quem preencheu / quem falta (admins) */}
      <Dialog open={!!viewResponses} onOpenChange={(o) => { if (!o) setViewResponses(null); }}>
        <DialogContent className="max-w-sm max-h-[75vh] overflow-y-auto">
          {viewResponses && (() => {
            const f = viewResponses;
            // Pessoas elegíveis para este formulário
            const eligiblePeople =
              f.targetType === "area"
                ? people.filter(p => (p.areas || []).includes(f.targetValue || ""))
                : f.targetType === "team"
                  ? people.filter(p => teams.find(t => t.id === f.targetValue)?.memberIds.includes(p.id))
                  : people;
            const completionsByUser = new Map(
              formCompletions.filter(c => c.formId === f.id).map(c => [c.userId, c])
            );
            const filled = eligiblePeople
              .map(p => ({ person: p, completion: p.userId ? completionsByUser.get(p.userId) : undefined }))
              .filter(item => !!item.completion);
            const missing = eligiblePeople.filter(p => !p.userId || !completionsByUser.has(p.userId));
            const personLabel = (p: typeof people[0]) =>
              (p.nickname && p.nickname.trim()) ? `${p.name} (${p.nickname.trim()})` : p.name;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-base">{f.title}</DialogTitle>
                  <p className="text-xs text-muted-foreground">
                    {targetLabel(f)} • {filled.length} de {eligiblePeople.length} preencheram
                  </p>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Preencheram ({filled.length})
                    </p>
                    {filled.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Ninguém preencheu ainda.</p>
                    ) : (
                      <ul className="space-y-0.5">
                        {filled.map(({ person: p, completion }) => (
                          <li key={p.id} className="text-sm text-foreground flex items-start gap-2 px-2 py-1.5 rounded bg-emerald-500/5">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate">{personLabel(p)}</span>
                              <span className="block text-[10px] text-muted-foreground leading-tight">
                                {formatCompletionDate(completion?.completedAt)}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider mb-1.5">
                      Faltam preencher ({missing.length})
                    </p>
                    {missing.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Todo mundo preencheu! 🎉</p>
                    ) : (
                      <ul className="space-y-0.5">
                        {missing.map(p => (
                          <li key={p.id} className="text-sm text-muted-foreground flex items-center gap-2 px-2 py-1 rounded bg-muted/40">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500/70 shrink-0" />
                            <span className="truncate">{personLabel(p)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </>
            );
          })()}
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
