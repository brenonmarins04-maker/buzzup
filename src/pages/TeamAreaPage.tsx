import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useData } from "@/contexts/DataContext";
import { UsersRound } from "lucide-react";
import { getTeamColor } from "@/lib/areas";
import { safeHref } from "@/lib/urlValidation";

// Reuse the existing tabs from AreaPage but scoped to a team
import AreaPage from "@/pages/AreaPage";

export default function TeamAreaPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { teams, people } = useData();

  const team = useMemo(() => teams.find(t => t.id === teamId), [teams, teamId]);

  if (!team) {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center py-20">
        <UsersRound className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">Time não encontrado.</p>
      </div>
    );
  }

  const members = people.filter(p => team.memberIds.includes(p.id));
  const teamColor = getTeamColor(team.id);

  return (
    <div className="animate-fade-in space-y-5">
      <div
        className="page-hero rounded-2xl px-5 py-4 flex items-center gap-3"
        style={{
          borderColor: teamColor,
        }}
      >
        <UsersRound className="h-5 w-5" style={{ color: teamColor }} />
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: teamColor }}>{team.name}</h1>
          <p className="text-xs text-muted-foreground">{members.length} assessor(es)</p>
        </div>
      </div>

      <TeamTabs teamId={team.id} teamName={team.name} />
    </div>
  );
}

// Team-scoped tabs: Quadro CB, Links úteis, Controle de Presenças
// These use a virtual "area" key based on team id so data is isolated per team
import { useAuth } from "@/contexts/AuthContext";
import { leadsKey } from "@/lib/leadership";
import { type ParkingItem, type ParkingItemStatus, type AttendanceStatus } from "@/contexts/DataContext";
import { Plus, ExternalLink, Pencil, Trash2, X, Settings, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";

function TeamTabs({ teamId, teamName }: { teamId: string; teamName: string }) {
  type Tab = "quadro" | "notas" | "presencas";
  const [tab, setTab] = useState<Tab>("quadro");

  const tabs: { v: Tab; label: string }[] = [
    { v: "quadro", label: "Quadro CB" },
    { v: "notas", label: "Links úteis" },
    { v: "presencas", label: "Controle de Presenças" },
  ];

  // Use team id as a virtual area key (prefixed to avoid collision with real areas)
  const teamAreaKey = `team_${teamId}`;

  return (
    <>
      <div className="glass-panel-soft rounded-2xl p-1 flex items-center gap-1 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.v} onClick={() => setTab(t.v)}
            className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors whitespace-nowrap ${tab === t.v ? "bg-white shadow-sm text-primary" : "text-muted-foreground hover:text-foreground hover:bg-white/50"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "notas" && <TeamNotesTab teamAreaKey={teamAreaKey} />}
      {tab === "quadro" && <TeamKanbanTab teamId={teamId} teamAreaKey={teamAreaKey} />}
      {tab === "presencas" && <TeamAttendanceTab teamId={teamId} teamAreaKey={teamAreaKey} />}
    </>
  );
}

function TeamNotesTab({ teamAreaKey }: { teamAreaKey: string }) {
  const { areaNotes, addAreaNote, updateAreaNote, deleteAreaNote } = useData();
  const { isAdmin } = useAuth();
  const notes = useMemo(() => areaNotes.filter(n => n.area === teamAreaKey).sort((a, b) => a.position - b.position), [areaNotes, teamAreaKey]);
  const [modal, setModal] = useState<{ open: boolean; id?: string }>({ open: false });
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const openCreate = () => { setModal({ open: true }); setName(""); setUrl(""); };
  const openEdit = (n: typeof notes[number]) => { setModal({ open: true, id: n.id }); setName(n.name); setUrl(n.url); };

  const save = async () => {
    if (!name.trim() || !url.trim()) { toast.error("Nome e link são obrigatórios"); return; }
    let finalUrl = url.trim();
    if (!/^https?:\/\//i.test(finalUrl)) finalUrl = `https://${finalUrl}`;
    if (modal.id) {
      const existing = notes.find(n => n.id === modal.id);
      if (existing) await updateAreaNote({ ...existing, name: name.trim(), url: finalUrl });
      toast.success("Atualizado");
    } else {
      await addAreaNote(teamAreaKey, name.trim(), finalUrl);
      toast.success("Atalho criado");
    }
    setModal({ open: false });
  };

  return (
    <div>
      {isAdmin && (
        <div className="flex justify-end mb-3">
          <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Novo atalho</Button>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {notes.map(n => (
          <div key={n.id} className="group hover-lift relative glass-panel-soft rounded-2xl p-4 hover:border-primary/40">
            <a href={safeHref(n.url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <ExternalLink className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground truncate flex-1">{n.name}</span>
            </a>
            {isAdmin && (
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(n)} className="p-1 hover:bg-accent rounded text-muted-foreground"><Pencil className="h-3 w-3" /></button>
                <button onClick={() => { deleteAreaNote(n.id); toast.success("Excluído"); }} className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
              </div>
            )}
          </div>
        ))}
        {notes.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full text-center py-8">Nenhum atalho ainda.</p>
        )}
      </div>

      <Dialog open={modal.open} onOpenChange={(o) => setModal({ open: o })}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{modal.id ? "Editar atalho" : "Novo atalho"}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Planilha de vendas" autoFocus />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Link</label>
              <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setModal({ open: false })}>Cancelar</Button>
              <Button type="submit">{modal.id ? "Salvar" : "Criar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TeamKanbanTab({ teamId, teamAreaKey }: { teamId: string; teamAreaKey: string }) {
  const { people, teams, parkingItems, addParkingItem, moveParkingItem, deleteParkingItem, updateParkingItem } = useData();
  const { isAdmin: _isAdmin, user } = useAuth();
  // Líderes deste time podem gerenciar o quadro. Sombreia isAdmin p/ incluir o líder.
  const isAdmin = _isAdmin || leadsKey(people, user?.id, teamAreaKey);

  const team = teams.find(t => t.id === teamId);
  const members = useMemo(() => people.filter(p => team?.memberIds.includes(p.id)), [people, team]);
  const items = useMemo(() => parkingItems.filter(p => p.area === teamAreaKey), [parkingItems, teamAreaKey]);

  // All person IDs belonging to the current logged-in user
  const myPersonIds = useMemo(() => {
    if (!user) return new Set<string>();
    return new Set(people.filter(p => p.userId === user.id).map(p => p.id));
  }, [user, people]);

  // ── Drag-and-drop ──
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  const onDragStart = (e: DragEvent, id: string) => {
    if (!isAdmin) { e.preventDefault(); return; }
    setDragId(id);
    e.dataTransfer!.effectAllowed = "move";
    e.dataTransfer!.setData("text/plain", id);
  };
  const onDragOver = (e: DragEvent, col: string) => {
    if (!isAdmin) return;
    e.preventDefault();
    setOverCol(col);
  };
  const onDrop = (e: DragEvent, targetPersonId: string | null) => {
    e.preventDefault();
    setOverCol(null);
    if (!isAdmin) return;
    const id = dragId || e.dataTransfer.getData("text/plain");
    if (!id) return;
    const item = items.find(i => i.id === id);
    if (!item) return;
    if (item.status === "done") {
      updateParkingItem({ ...item, personId: targetPersonId, status: "in-progress" });
    } else if (item.personId !== targetPersonId) {
      moveParkingItem(id, targetPersonId);
    }
    setDragId(null);
  };

  // ── Task completion with animation (F5-safe: DB saved immediately) ──
  const [completing, setCompleting] = useState<Set<string>>(new Set());
  const [doneOpen, setDoneOpen] = useState(false);

  const markDone = (item: ParkingItem) => {
    if (item.status === "done") return;
    // Save to DB immediately — no F5 revert
    updateParkingItem({ ...item, status: "done" });
    // Fade out: a aba de concluídas NÃO abre sozinha
    setCompleting(prev => { const n = new Set(prev); n.add(item.id); return n; });
    setTimeout(() => {
      setCompleting(prev => { const n = new Set(prev); n.delete(item.id); return n; });
    }, 600);
  };

  // Cards in completing set remain visible during animation
  const columnItems = (pid: string | null) =>
    items.filter(i => i.personId === pid && (i.status !== "done" || completing.has(i.id))).sort((a, b) => a.position - b.position);
  const doneItems = useMemo(() => items.filter(i => i.status === "done" && !completing.has(i.id)).sort((a, b) => a.position - b.position), [items, completing]);

  // ── Edit modal ──
  const [modal, setModal] = useState<{ open: boolean; item?: ParkingItem | null }>({ open: false });
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  // Na criação aceita várias pessoas (copia a demanda para cada uma); na edição, uma só.
  const [editPersonIds, setEditPersonIds] = useState<string[]>([]);
  const [points, setPoints] = useState<number>(1);

  const openCreate = () => { setModal({ open: true, item: null }); setTitle(""); setDate(""); setEditPersonIds([]); setPoints(1); };
  const openEdit = (item: ParkingItem) => {
    setModal({ open: true, item });
    setTitle(item.title);
    setDate(item.date || "");
    setEditPersonIds(item.personId ? [item.personId] : []);
    setPoints(item.points || 1);
  };

  const save = async () => {
    if (!title.trim()) { toast.error("Título obrigatório"); return; }
    if (!date) { toast.error("Data obrigatória"); return; }
    if (modal.item) {
      await updateParkingItem({ ...modal.item, title: title.trim(), date, personId: editPersonIds[0] || null, points });
      toast.success("Atualizado");
    } else {
      // Cria uma cópia da demanda para cada pessoa selecionada (mesma data, pontos e nome).
      const targets = editPersonIds.length > 0 ? editPersonIds : [null];
      for (const pid of targets) {
        await addParkingItem(teamAreaKey, title.trim(), date, "", points, pid);
      }
      toast.success(targets.length > 1 ? `Demanda criada para ${targets.length} pessoas` : "Demanda criada");
    }
    setModal({ open: false });
  };

  // ── Card renderer ──
  const renderCard = (item: ParkingItem) => {
    const isDone = item.status === "done";
    const isCompleting = completing.has(item.id) && !isDone;
    const tint = isDone || isCompleting ? "#10B981" : "#F59E0B";
    const memberCanDone = !isAdmin && item.personId !== null && myPersonIds.has(item.personId);

    return (
      <div
        key={item.id}
        draggable={isAdmin}
        onDragStart={(e) => onDragStart(e, item.id)}
        onDragEnd={() => setDragId(null)}
        className={`group demand-hover bg-white/70 border rounded-2xl p-3 text-sm shadow-sm overflow-hidden ${isAdmin ? "cursor-grab active:cursor-grabbing" : ""}`}
        style={{ borderColor: `${tint}66`, backgroundColor: `${tint}10`, opacity: isCompleting ? 0 : 1, transition: "opacity 550ms ease, background-color 300ms ease, border-color 300ms ease, transform 180ms ease, box-shadow 180ms ease" }}
      >
        {/* Full controls for admin */}
        {isAdmin && (
          <div className="flex items-center gap-1.5 mb-2.5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); updateParkingItem({ ...item, status: "in-progress" }); }}
              title="Em andamento"
              className="h-5 w-5 rounded-full transition-all border-2"
              style={item.status === "in-progress" && !isCompleting
                ? { backgroundColor: "#F59E0B", borderColor: "#F59E0B", boxShadow: "0 2px 6px #F59E0B88" }
                : { backgroundColor: "transparent", borderColor: "#F59E0B" }}
            />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); markDone(item); }}
              title="Concluída"
              className="h-5 w-5 rounded-full transition-all border-2"
              style={isDone || isCompleting
                ? { backgroundColor: "#10B981", borderColor: "#10B981", boxShadow: "0 2px 6px #10B98188" }
                : { backgroundColor: "transparent", borderColor: "#10B981" }}
            />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); deleteParkingItem(item.id).then(() => toast.success("Excluído")); }}
              className="ml-auto text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              title="Excluir"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {/* Done-only button for member assigned to this task */}
        {memberCanDone && (
          <div className="flex items-center gap-1.5 mb-2.5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); markDone(item); }}
              title="Marcar como concluída"
              className="h-5 w-5 rounded-full transition-all border-2"
              style={isDone || isCompleting
                ? { backgroundColor: "#10B981", borderColor: "#10B981", boxShadow: "0 2px 6px #10B98188" }
                : { backgroundColor: "transparent", borderColor: "#10B981" }}
            />
            <span className="text-[10px] text-muted-foreground">Concluir tarefa</span>
          </div>
        )}
        <div onClick={() => isAdmin && openEdit(item)} className={isAdmin ? "cursor-pointer" : ""}>
          <div className="flex items-start justify-between gap-2">
            <span className={`font-semibold leading-snug flex-1 min-w-0 break-words overflow-hidden ${isDone ? "text-muted-foreground line-through" : "text-foreground"}`}>{item.title}</span>
            {item.points ? (
              <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md text-white" style={{ backgroundColor: tint }}>
                {item.points}p
              </span>
            ) : null}
          </div>
          {item.description && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-3 break-words">{item.description}</p>}
          {item.date && (
            <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md text-white" style={{ backgroundColor: tint }}>
              {new Date(item.date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Column renderer ──
  const renderColumn = (colPersonId: string | null, colTitle: string, accent?: boolean) => {
    const colKey = colPersonId ?? "__park";
    const isOver = overCol === colKey;
    return (
      <div
        key={colKey}
        className={`w-full min-w-[172px] sm:min-w-[190px] flex flex-col rounded-2xl border transition-colors overflow-hidden ${isOver ? "border-primary/60 bg-primary/5" : "border-border glass-panel-soft"}`}
        onDragOver={(e) => onDragOver(e, colKey)}
        onDragLeave={() => setOverCol(null)}
        onDrop={(e) => onDrop(e, colPersonId)}
      >
        <div className={`px-4 py-3 border-b flex items-center justify-between ${accent ? "bg-white/70 border-primary/30" : "border-border/70"}`}>
          <span className="text-sm font-semibold text-foreground truncate min-w-0">{colTitle}</span>
          <span className="text-xs text-muted-foreground">{columnItems(colPersonId).length}</span>
        </div>
        <div className="flex-1 p-3 flex flex-col gap-3 min-h-[160px]">
          {colPersonId === null && isAdmin && (
            <button onClick={openCreate}
              className="w-full flex items-center justify-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground border border-dashed border-border hover:border-primary/50 rounded-2xl py-2 transition-colors bg-white/45 hover:bg-white/80">
              <Plus className="h-3.5 w-3.5" /> nova demanda
            </button>
          )}
          {columnItems(colPersonId).map(item => renderCard(item))}
        </div>
        {/* Concluídas accordion — only in Demandas column */}
        {colPersonId === null && (
          <div className="border-t border-border bg-white/45">
            <button type="button" onClick={() => setDoneOpen(o => !o)}
              className="w-full px-3 py-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground">
              <span className="flex items-center gap-1.5">
                {doneOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                Concluídas
              </span>
              <span className="text-[10px] bg-muted rounded-full px-1.5 py-0.5">{doneItems.length}</span>
            </button>
            {doneOpen && (
              <div className="p-3 pt-0 flex flex-col gap-2">
                {doneItems.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground/70 text-center py-3">Nenhuma demanda concluída</div>
                ) : doneItems.map(item => (
                  <div key={item.id} className="demand-hover bg-white/70 border rounded-2xl p-3 text-sm" style={{ borderColor: "#10B98166", backgroundColor: "#10B98110" }}>
                    <p className="font-semibold text-muted-foreground line-through break-words">{item.title}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="flex gap-3 pb-3 overflow-x-auto scrollbar-thin pr-2">
        {renderColumn(null, "Demandas", true)}
        {members.map(m => renderColumn(m.id, m.name))}
      </div>

      <Dialog open={modal.open} onOpenChange={(o) => setModal({ open: o, item: null })}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{modal.item ? "Editar demanda" : "Nova demanda"}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Título</label>
              <Input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Descreva a demanda" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{modal.item ? "Responsável" : "Responsáveis"}</label>
              <div className="flex flex-wrap gap-2">
                {members.map(p => {
                  const selected = editPersonIds.includes(p.id);
                  return (
                    <button key={p.id} type="button"
                      onClick={() => {
                        if (modal.item) setEditPersonIds(selected ? [] : [p.id]);
                        else setEditPersonIds(prev => selected ? prev.filter(id => id !== p.id) : [...prev, p.id]);
                      }}
                      className={`px-3 h-8 rounded-full text-sm font-medium border transition-all ${selected ? "bg-primary text-white border-primary" : "bg-muted border-border text-foreground"}`}>
                      {p.name}
                    </button>
                  );
                })}
              </div>
              {!modal.item && (
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  {editPersonIds.length > 1
                    ? `A mesma demanda será criada para ${editPersonIds.length} pessoas.`
                    : "Selecione uma ou mais pessoas — a demanda é copiada para cada uma."}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Data</label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Pontos</label>
              <div className="flex gap-2">
                {[1, 2, 3].map(n => (
                  <button key={n} type="button" onClick={() => setPoints(n)}
                    className={`flex-1 h-10 rounded-full text-sm font-bold border transition-all ${points === n ? "bg-primary text-white border-primary" : "bg-muted border-border text-foreground"}`}>
                    {n}p
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setModal({ open: false, item: null })}>Cancelar</Button>
              <Button type="submit">{modal.item ? "Salvar" : "Criar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TeamAttendanceTab({ teamId, teamAreaKey }: { teamId: string; teamAreaKey: string }) {
  const { people, teams, attendanceSettings, attendanceRecords, upsertAttendanceSetting, setAttendance, clearAttendance } = useData();
  const { isAdmin: _isAdmin, user } = useAuth();
  // Líder do time também gerencia presenças do time
  const isAdmin = _isAdmin || leadsKey(people, user?.id, teamAreaKey);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="text-center max-w-sm">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">🔒</div>
          <h3 className="font-semibold text-foreground mb-1">Acesso Restrito</h3>
          <p className="text-sm text-muted-foreground">Apenas diretores podem gerenciar presenças.</p>
        </div>
      </div>
    );
  }

  const team = teams.find(t => t.id === teamId);
  const members = useMemo(() => people.filter(p => team?.memberIds.includes(p.id)), [people, team]);
  const setting = useMemo(() => attendanceSettings.find(s => s.area === teamAreaKey), [attendanceSettings, teamAreaKey]);

  const intervalDays = setting?.intervalDays ?? 7;
  const startDate = setting?.startDate || new Date().toISOString().slice(0, 10);
  const meetingCount = setting?.meetingCount ?? 8;

  const addDaysISO = (iso: string, days: number) => {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    return dt.toISOString().slice(0, 10);
  };

  const dates = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < meetingCount; i++) out.push(addDaysISO(startDate, i * intervalDays));
    return out;
  }, [startDate, intervalDays, meetingCount]);

  const recordMap = useMemo(() => {
    const m = new Map<string, { status: AttendanceStatus; justification: string }>();
    attendanceRecords.filter(r => r.area === teamAreaKey).forEach(r => {
      m.set(`${r.personId}|${r.date}`, { status: r.status, justification: r.justification });
    });
    return m;
  }, [attendanceRecords, teamAreaKey]);

  const handleCellClick = async (personId: string, date: string) => {
    const current = recordMap.get(`${personId}|${date}`);
    if (!current) { await setAttendance(teamAreaKey, personId, date, "P"); return; }
    if (current.status === "P") { await setAttendance(teamAreaKey, personId, date, "F"); return; }
    if (current.status === "F") { await setAttendance(teamAreaKey, personId, date, "FJ"); return; }
    await clearAttendance(teamAreaKey, personId, date);
  };

  const fmtDate = (iso: string) => { const [, m, d] = iso.split("-"); return `${d}/${m}`; };

  const STATUS_META: Record<AttendanceStatus, { label: string; bg: string; text: string }> = {
    P: { label: "Presente", bg: "bg-emerald-500", text: "text-white" },
    F: { label: "Faltou", bg: "bg-red-500", text: "text-white" },
    FJ: { label: "Falta Justificada", bg: "bg-amber-400", text: "text-black" },
  };

  if (members.length === 0) {
    return <div className="text-sm text-muted-foreground py-8 text-center">Nenhum assessor neste time.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-4 w-4 rounded-full bg-emerald-500 text-white text-[9px] font-bold flex items-center justify-center">P</span> Presente</span>
        <span className="flex items-center gap-1.5"><span className="h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">F</span> Faltou</span>
        <span className="flex items-center gap-1.5"><span className="h-4 w-4 rounded-full bg-amber-400 text-black text-[9px] font-bold flex items-center justify-center">FJ</span> Falta justificada</span>
      </div>
      <div className="rounded-lg border border-border overflow-x-auto bg-card">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/60 border-b border-border">
              <th className="text-left font-semibold px-3 py-2 sticky left-0 bg-muted/60 z-10 min-w-[160px]">Assessor</th>
              {dates.map(d => <th key={d} className="text-center font-semibold px-2 py-2 text-xs whitespace-nowrap">{fmtDate(d)}</th>)}
            </tr>
          </thead>
          <tbody>
            {members.map(m => (
              <tr key={m.id} className="border-b border-border last:border-b-0 hover:bg-accent/20">
                <td className="px-3 py-2 font-medium text-foreground sticky left-0 bg-card z-10">{m.name}</td>
                {dates.map(d => {
                  const rec = recordMap.get(`${m.id}|${d}`);
                  if (rec) {
                    const meta = STATUS_META[rec.status];
                    return (
                      <td key={d} className="px-2 py-2 text-center align-middle">
                        <button type="button" onClick={() => handleCellClick(m.id, d)}
                          className={`h-7 w-7 rounded-full text-[10px] font-bold flex items-center justify-center mx-auto ${meta.bg} ${meta.text} hover:opacity-80 cursor-pointer`}>
                          {rec.status}
                        </button>
                      </td>
                    );
                  }
                  return (
                    <td key={d} className="px-2 py-2 text-center align-middle">
                      <button type="button" onClick={() => handleCellClick(m.id, d)}
                        className="h-7 w-7 rounded-full border border-dashed border-border mx-auto block hover:border-primary hover:bg-primary/5 cursor-pointer" />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">Clique na bolinha para alternar: vazio → P → F → FJ → vazio.</p>
    </div>
  );
}
