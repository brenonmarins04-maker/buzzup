import { useMemo, useState } from "react";
import { useData, type WorkspaceForm, type WorkspaceFormTarget } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FileText, Plus, ExternalLink, CheckCircle2, Trash2, Users, UsersRound, Globe, ChevronDown, ChevronUp, Filter, Pencil, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AREAS, getAreaLabel } from "@/lib/areas";
import { isValidHttpUrl, safeHref } from "@/lib/urlValidation";

export default function FormsSection() {
  const { forms, formCompletions, teams, people, addForm, updateForm, deleteForm, markFormCompleted, unmarkFormCompleted, declineForm } = useData();
  const { user, isAdmin } = useAuth();

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [targetType, setTargetType] = useState<WorkspaceFormTarget>("all");
  const [targetValues, setTargetValues] = useState<string[]>([]);
  const [editing, setEditing] = useState<WorkspaceForm | null>(null);
  const [points, setPoints] = useState(1);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<WorkspaceForm | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  // Admin: popup com quem preencheu / quem falta
  const [viewResponses, setViewResponses] = useState<WorkspaceForm | null>(null);
  const [responseAreaFilter, setResponseAreaFilter] = useState<string>("all");

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

  const formTargets = (f: WorkspaceForm) =>
    (f.targetValues?.length ? f.targetValues : (f.targetValue ? [f.targetValue] : []));

  const isEligible = (f: WorkspaceForm) => {
    if (f.targetType === "all") return true;
    const targets = formTargets(f);
    if (f.targetType === "area") return targets.some(v => myAreas.has(v));
    if (f.targetType === "team") return targets.some(v => myTeamIds.has(v));
    return false;
  };

  // Formulários pendentes para mim (elegível e ainda não preenchido)
  const myPending = forms.filter(f => isEligible(f) && !completedByMe.has(f.id));
  // Formulários que eu já marquei como preenchidos
  const myCompleted = forms.filter(f => isEligible(f) && completedByMe.has(f.id));

  const targetLabel = (f: WorkspaceForm) => {
    const targets = formTargets(f);
    if (targets.length === 0) return "Todos";
    const names = f.targetType === "area"
      ? targets.map(v => getAreaLabel(v) || v)
      : targets.map(v => teams.find(t => t.id === v)?.name || "Time");
    if (names.length === 1) return names[0];
    return `${names[0]} +${names.length - 1}`;
  };
  const TargetIcon = (f: WorkspaceForm) =>
    f.targetType === "area" ? <Users className="h-3 w-3" /> :
    f.targetType === "team" ? <UsersRound className="h-3 w-3" /> :
    <Globe className="h-3 w-3" />;

  /** Pessoas elegíveis a um formulário (usadas nas contagens e no popup). */
  const eligiblePeopleFor = (f: WorkspaceForm) => {
    const targets = formTargets(f);
    if (f.targetType === "area") {
      return people.filter(p => (p.areas || []).some(a => targets.includes(a)));
    }
    if (f.targetType === "team") {
      return people.filter(p => teams.some(t => targets.includes(t.id) && t.memberIds.includes(p.id)));
    }
    return people;
  };

  /** Quem preencheu de fato (recusa não conta como preenchido). */
  const filledCount = (formId: string) =>
    formCompletions.filter(c => c.formId === formId && c.status !== "declined").length;

  const missingCount = (f: WorkspaceForm) => {
    const done = new Set(
      formCompletions.filter(c => c.formId === f.id && c.status !== "declined").map(c => c.userId),
    );
    return eligiblePeopleFor(f).filter(p => !p.userId || !done.has(p.userId)).length;
  };
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
    setTitle(""); setUrl(""); setDescription(""); setTargetType("all"); setTargetValues([]); setPoints(1); setEditing(null);
  };

  const openEdit = (f: WorkspaceForm) => {
    setEditing(f);
    setTitle(f.title);
    setUrl(f.url);
    setDescription(f.description || "");
    setTargetType(f.targetType);
    setTargetValues(formTargets(f));
    setPoints(f.points ?? 1);
    setCreateOpen(true);
  };

  const toggleTarget = (value: string) => {
    setTargetValues(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  };

  const onCreate = async () => {
    if (!title.trim() || !url.trim() || busy) return;
    if (targetType !== "all" && targetValues.length === 0) {
      toast.error(targetType === "area" ? "Escolha ao menos uma área" : "Escolha ao menos um time");
      return;
    }
    let finalUrl = url.trim();
    if (!/^https?:\/\//i.test(finalUrl)) finalUrl = `https://${finalUrl}`;
    if (!isValidHttpUrl(finalUrl)) { toast.error("URL inválida. Use https://..."); return; }
    setBusy(true);
    if (editing) {
      await updateForm(editing.id, {
        title: title.trim(), url: finalUrl, targetType,
        targetValues: targetType === "all" ? [] : targetValues,
        description: description.trim(), points,
      });
      toast.success("Formulário atualizado!");
    } else {
      await addForm(title.trim(), finalUrl, targetType, targetType === "all" ? [] : targetValues, description.trim(), points);
      toast.success("Formulário publicado!");
    }
    setBusy(false);
    resetModal();
    setCreateOpen(false);
  };

  const nothingToShow = myPending.length === 0 && myCompleted.length === 0 && (!isAdmin || forms.length === 0);

  return (
    <div className="glass-panel rounded-2xl p-4 md:p-5 h-full flex min-w-0 flex-col">
      <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <FileText className="h-4 w-4 text-[#8B5CF6]" /> Formulários
        </h2>
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)} className="shrink-0 rounded-2xl">
            <Plus className="h-3.5 w-3.5 mr-1" /> Novo formulário
          </Button>
        )}
      </div>

      {/* Subtítulo contextual — muda conforme o papel de quem vê */}
      <p className="text-xs text-muted-foreground mb-3 md:mb-4">
        {myPending.length > 0
          ? `${myPending.length} pendente${myPending.length > 1 ? "s" : ""} para você preencher`
          : isAdmin
            ? `${forms.length} formulário${forms.length !== 1 ? "s" : ""} publicado${forms.length !== 1 ? "s" : ""} no workspace`
            : "Você está em dia com seus formulários"}
      </p>

      {nothingToShow && (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-6">
          <CheckCircle2 className="h-8 w-8 text-[#8B5CF6]/40" />
          <p className="text-xs text-muted-foreground">
            {isAdmin ? "Nenhum formulário publicado ainda." : "Nenhum formulário pendente. 🎉"}
          </p>
        </div>
      )}

      {/* Meus formulários pendentes */}
      {myPending.length > 0 && (
        <div className="grid grid-cols-1 gap-3">
          {myPending.map(f => (
            <div key={f.id} className="hover-lift flex w-full min-w-0 max-w-full flex-col gap-3 overflow-hidden rounded-2xl border border-[#8B5CF6]/20 bg-white/62 p-4">
              <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="break-words text-sm font-semibold text-foreground [overflow-wrap:anywhere]">{f.title}</p>
                  {f.description && (
                    <p className="mt-1 line-clamp-2 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">{f.description}</p>
                  )}
                </div>
                <div className="flex min-w-0 max-w-[45%] shrink-0 flex-col items-end gap-1">
                  <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-[#8B5CF6]/15 px-2 py-0.5 text-right text-[10px] font-semibold text-[#8B5CF6]">
                    {TargetIcon(f)} {targetLabel(f)}
                  </span>
                  <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700">
                    +{f.points ?? 1} {(f.points ?? 1) > 1 ? "pts" : "pt"}
                  </span>
                </div>
              </div>
              <div className="grid w-full min-w-0 grid-cols-2 items-stretch gap-2 border-t border-border/30 pt-2">
                <a
                  href={safeHref(f.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full min-w-0 items-center justify-center gap-1.5 break-words rounded-md bg-[#8B5CF6] px-2 py-2 text-center text-xs font-medium leading-tight text-white transition-all [overflow-wrap:anywhere] hover:bg-[#7C3AED]"
                >
                  <ExternalLink className="h-3 w-3" /> Abrir formulário
                </a>
                <button
                  onClick={() => { markFormCompleted(f.id); }}
                  title="Depois de preencher o formulário, clique aqui para marcar como concluído"
                  className="flex w-full min-w-0 items-center justify-center gap-1.5 break-words rounded-md border border-emerald-400/60 bg-emerald-500/15 px-2 py-2 text-center text-xs font-semibold leading-tight text-emerald-700 transition-all [overflow-wrap:anywhere] hover:bg-emerald-500/25"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Já preenchi
                </button>
                {/* Ação secundária: discreta, sem competir com as duas principais */}
                <button
                  onClick={() => { declineForm(f.id); }}
                  title="Marcar que você não vai preencher este formulário"
                  className="col-span-2 flex w-full min-w-0 items-center justify-center gap-1 break-words rounded-md border border-transparent px-2 py-2 text-center text-[10px] font-medium leading-tight text-muted-foreground transition-all [overflow-wrap:anywhere] hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-600"
                >
                  <XCircle className="h-3 w-3" /> Não vou preencher
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
                <div key={f.id} className="hover-lift flex items-center gap-2.5 px-3 py-2.5 rounded-2xl border border-emerald-300/40 bg-emerald-500/5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{f.title}</p>
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                      {TargetIcon(f)} {targetLabel(f)}
                    </span>
                  </div>
                  <a
                    href={safeHref(f.url)}
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
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Gerenciar publicados ({forms.length})</p>
          <ul className="space-y-1.5">
            {forms.map(f => (
              <li key={f.id} className="hover-lift flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/58 border border-border/55 min-w-0">
                <FileText className="h-3.5 w-3.5 text-[#8B5CF6] shrink-0" />
                <span className="flex-1 min-w-0 text-sm font-medium text-foreground truncate">{f.title}</span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                  {TargetIcon(f)} {targetLabel(f)}
                </span>
                <a
                  href={safeHref(f.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Abrir formulário"
                  className="p-1 rounded text-[#8B5CF6] hover:bg-[#8B5CF6]/10 shrink-0"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <button
                  onClick={() => setViewResponses(f)}
                  title="Ver quem preencheu e quem falta"
                  className="flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <span className="text-xs font-bold text-emerald-600" title="Preencheram">
                    ({filledCount(f.id)})
                  </span>
                  <span className="text-xs font-bold text-red-500" title="Não preencheram">
                    ({missingCount(f)})
                  </span>
                </button>
                <button
                  onClick={() => openEdit(f)}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent shrink-0"
                  title="Editar formulário"
                >
                  <Pencil className="h-3.5 w-3.5" />
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
          <DialogHeader><DialogTitle>{editing ? "Editar formulário" : "Novo formulário"}</DialogTitle></DialogHeader>
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
              <Label htmlFor="form-points">Pontos na gamificação</Label>
              <Input
                id="form-points"
                type="number"
                min={1}
                max={99}
                value={points}
                onChange={e => setPoints(Math.min(99, Math.max(1, Math.round(Number(e.target.value) || 1))))}
              />
              <p className="text-[11px] text-muted-foreground">
                Quanto cada pessoa ganha ao marcar este formulário como preenchido.
              </p>
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
                    onClick={() => { setTargetType(opt.v); setTargetValues([]); }}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
            {targetType !== "all" && (
              <div className="space-y-1.5">
                <Label>{targetType === "area" ? "Áreas" : "Times"}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {(targetType === "area"
                    ? AREAS.map(a => ({ value: a.key, label: getAreaLabel(a.key) }))
                    : teams.map(t => ({ value: t.id, label: t.name }))
                  ).map(opt => {
                    const selected = targetValues.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleTarget(opt.value)}
                        className={`px-3 h-9 rounded-full text-sm font-medium border transition-all ${
                          selected
                            ? "bg-[#8B5CF6] text-white border-[#8B5CF6]"
                            : "bg-background text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                {(targetType === "team" && teams.length === 0) ? (
                  <p className="text-[11px] text-muted-foreground">Nenhum time criado ainda.</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    {targetValues.length === 0
                      ? `Selecione ${targetType === "area" ? "uma ou mais áreas" : "um ou mais times"}.`
                      : `${targetValues.length} selecionado${targetValues.length > 1 ? "s" : ""}.`}
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); resetModal(); }}>Cancelar</Button>
            <Button onClick={onCreate} disabled={busy || !title.trim() || !url.trim()}>
              {busy ? "Salvando…" : editing ? "Salvar" : "Publicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: quem preencheu / quem falta (admins) */}
      <Dialog open={!!viewResponses} onOpenChange={(o) => { if (!o) { setViewResponses(null); setResponseAreaFilter("all"); } }}>
        <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
          {viewResponses && (() => {
            const f = viewResponses;
            const personLabel = (p: typeof people[0]) =>
              (p.nickname && p.nickname.trim()) ? `${p.name} (${p.nickname.trim()})` : p.name;

            // Todas as pessoas elegíveis para o formulário
            const allEligible = eligiblePeopleFor(f);

            // Áreas presentes entre as pessoas elegíveis (para o filtro)
            const areasInForm = Array.from(
              new Set(allEligible.flatMap(p => p.areas?.length ? p.areas : (p.area ? [p.area] : [])))
            );

            // Aplicar filtro de área
            const eligiblePeople = responseAreaFilter === "all"
              ? allEligible
              : allEligible.filter(p => {
                  const areas = p.areas?.length ? p.areas : (p.area ? [p.area] : []);
                  return areas.includes(responseAreaFilter);
                });

            const completionsByUser = new Map(
              formCompletions.filter(c => c.formId === f.id).map(c => [c.userId, c])
            );
            // Recusa não conta como preenchido — aparece entre os que faltam
            const filled = eligiblePeople
              .map(p => ({ person: p, completion: p.userId ? completionsByUser.get(p.userId) : undefined }))
              .filter(item => !!item.completion && item.completion.status !== "declined");
            const missing = eligiblePeople
              .map(p => ({ person: p, completion: p.userId ? completionsByUser.get(p.userId) : undefined }))
              .filter(item => !item.completion || item.completion.status === "declined");

            return (
              <>
                <DialogHeader className="shrink-0">
                  <DialogTitle className="text-base">{f.title}</DialogTitle>
                  <p className="text-xs text-muted-foreground">
                    {targetLabel(f)} • <span className="font-bold text-emerald-600">({filled.length})</span> preencheram
                    {" · "}<span className="font-bold text-red-500">({missing.length})</span> não preencheram
                    {responseAreaFilter !== "all" && ` (filtrando por área)`}
                  </p>
                </DialogHeader>

                {/* Filtro de área — visível quando há mais de uma área */}
                {areasInForm.length > 1 && (
                  <div className="shrink-0 -mx-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Filter className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Filtrar por área</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setResponseAreaFilter("all")}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                          responseAreaFilter === "all"
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Todas
                      </button>
                      {areasInForm.map(aKey => {
                        const color = AREAS.find(a => a.key === aKey)?.color || "#6b7280";
                        const active = responseAreaFilter === aKey;
                        return (
                          <button
                            key={aKey}
                            onClick={() => setResponseAreaFilter(aKey)}
                            className="px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors"
                            style={active
                              ? { backgroundColor: `${color}22`, color, borderColor: `${color}88` }
                              : { borderColor: "var(--border)", color: "var(--muted-foreground)" }
                            }
                          >
                            {getAreaLabel(aKey) || aKey}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="overflow-y-auto flex-1 space-y-4 pr-1">
                  {/* Preencheram */}
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
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
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

                  {/* Faltam */}
                  <div>
                    <p className="text-[11px] font-semibold text-red-500 uppercase tracking-wider mb-1.5">
                      Não preencheram ({missing.length})
                    </p>
                    {missing.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Todo mundo preencheu! 🎉</p>
                    ) : (
                      <ul className="space-y-0.5">
                        {missing.map(({ person: p, completion }) => (
                          <li key={p.id} className="text-sm text-muted-foreground flex items-center gap-2 px-2 py-1 rounded bg-muted/40">
                            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${completion?.status === "declined" ? "bg-red-500" : "bg-amber-500/70"}`} />
                            <span className="truncate flex-1">{personLabel(p)}</span>
                            {completion?.status === "declined" && (
                              <span className="text-[10px] font-semibold text-red-500 shrink-0">não vai preencher</span>
                            )}
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
