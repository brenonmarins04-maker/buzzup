import { useState, useMemo, type DragEvent } from "react";
import { useData, type ParkingItem, type LeadThermometerItem, type AttendanceStatus } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { AREAS, type AreaKey, getAreaLabel } from "@/lib/areas";
import { Plus, ExternalLink, Pencil, Trash2, X, Settings } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";

type Props = { area: AreaKey };

export default function AreaPage({ area }: Props) {
  type Tab = "quadro" | "notas" | "presencas" | "termometro";
  const [tab, setTab] = useState<Tab>("quadro");
  const label = getAreaLabel(area);
  const meta = AREAS.find(a => a.key === area)!;
  const tabs: { v: Tab; label: string }[] = [
    { v: "quadro", label: "Quadro CB" },
    { v: "notas", label: "Notas" },
    { v: "presencas", label: "Controle de Presenças" },
    ...(area === "mercado" ? [{ v: "termometro" as Tab, label: "Termômetro de Lead" }] : []),
  ];

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-center gap-3">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: meta.color }} />
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">{label}</h1>
      </div>

      <div className="flex items-center gap-1 border-b border-border">
        {tabs.map(t => (
          <button key={t.v} onClick={() => setTab(t.v as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${tab === t.v ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "notas" && <NotesTab area={area} />}
      {tab === "quadro" && <KanbanTab area={area} />}
      {tab === "presencas" && <AttendanceTab area={area} />}
      {tab === "termometro" && area === "mercado" && <LeadThermometerTab />}
    </div>
  );
}

// ===== Notas (link shortcuts) =====
function NotesTab({ area }: { area: AreaKey }) {
  const { areaNotes, addAreaNote, updateAreaNote, deleteAreaNote } = useData();
  const { isAdmin } = useAuth();
  const notes = useMemo(() => areaNotes.filter(n => n.area === area).sort((a, b) => a.position - b.position), [areaNotes, area]);
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
      await addAreaNote(area, name.trim(), finalUrl);
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
          <div key={n.id} className="group relative bg-card border border-border rounded-lg p-4 hover:border-primary/40 transition-colors">
            <a href={n.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3">
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

// ===== Controle de Presenças =====
const PRESET_OPTIONS = [
  { label: "Semanal", days: 7 },
  { label: "Quinzenal", days: 14 },
  { label: "Mensal", days: 30 },
];

const STATUS_META: Record<AttendanceStatus, { label: string; bg: string; text: string }> = {
  P:  { label: "Presente",           bg: "bg-emerald-500", text: "text-white" },
  F:  { label: "Faltou",             bg: "bg-red-500",     text: "text-white" },
  FJ: { label: "Falta Justificada",  bg: "bg-amber-400",   text: "text-black" },
};

function addDaysISO(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function AttendanceTab({ area }: { area: AreaKey }) {
  const { people, attendanceSettings, attendanceRecords, upsertAttendanceSetting, setAttendance, clearAttendance } = useData();
  const { isAdmin } = useAuth();

  const members = useMemo(() => people.filter(p => p.area === area), [people, area]);
  const setting = useMemo(() => attendanceSettings.find(s => s.area === area), [attendanceSettings, area]);

  const intervalDays = setting?.intervalDays ?? 7;
  const startDate = setting?.startDate || new Date().toISOString().slice(0, 10);
  const meetingCount = setting?.meetingCount ?? 8;

  const dates = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < meetingCount; i++) out.push(addDaysISO(startDate, i * intervalDays));
    return out;
  }, [startDate, intervalDays, meetingCount]);

  const recordMap = useMemo(() => {
    const m = new Map<string, { status: AttendanceStatus; justification: string }>();
    attendanceRecords.filter(r => r.area === area).forEach(r => {
      m.set(`${r.personId}|${r.date}`, { status: r.status, justification: r.justification });
    });
    return m;
  }, [attendanceRecords, area]);

  // settings popover state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sIntervalDays, setSIntervalDays] = useState(intervalDays);
  const [sStartDate, setSStartDate] = useState(startDate);
  const [sMeetingCount, setSMeetingCount] = useState(meetingCount);

  const openSettings = () => {
    setSIntervalDays(intervalDays);
    setSStartDate(startDate);
    setSMeetingCount(meetingCount);
    setSettingsOpen(true);
  };

  const saveSettings = async () => {
    if (!sStartDate) { toast.error("Data inicial obrigatória"); return; }
    if (sIntervalDays < 1) { toast.error("Intervalo inválido"); return; }
    if (sMeetingCount < 1 || sMeetingCount > 52) { toast.error("Quantidade entre 1 e 52"); return; }
    await upsertAttendanceSetting(area, { intervalDays: sIntervalDays, startDate: sStartDate, meetingCount: sMeetingCount });
    toast.success("Configuração salva");
    setSettingsOpen(false);
  };

  // justification dialog
  const [justifyModal, setJustifyModal] = useState<{ open: boolean; personId: string; date: string; text: string }>({ open: false, personId: "", date: "", text: "" });

  const handleCellClick = async (personId: string, date: string) => {
    if (!isAdmin) return;
    const current = recordMap.get(`${personId}|${date}`);
    // Cycle: empty -> P -> F -> FJ -> empty
    if (!current) { await setAttendance(area, personId, date, "P"); return; }
    if (current.status === "P") { await setAttendance(area, personId, date, "F"); return; }
    if (current.status === "F") {
      setJustifyModal({ open: true, personId, date, text: "" });
      return;
    }
    // FJ -> clear
    await clearAttendance(area, personId, date);
  };

  const saveJustification = async () => {
    const { personId, date, text } = justifyModal;
    if (!text.trim()) { toast.error("Justificativa obrigatória"); return; }
    await setAttendance(area, personId, date, "FJ", text.trim());
    setJustifyModal({ open: false, personId: "", date: "", text: "" });
    toast.success("Falta justificada registrada");
  };

  const fmtDate = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}`;
  };

  if (members.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        Nenhum membro vinculado a essa área. Atribua membros em Pessoas → Membros.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-4 w-4 rounded-full bg-emerald-500 text-white text-[9px] font-bold flex items-center justify-center">P</span> Presente</span>
          <span className="flex items-center gap-1.5"><span className="h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">F</span> Faltou</span>
          <span className="flex items-center gap-1.5"><span className="h-4 w-4 rounded-full bg-amber-400 text-black text-[9px] font-bold flex items-center justify-center">FJ</span> Falta justificada</span>
        </div>
        {isAdmin && (
          <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" onClick={openSettings}>
                <Settings className="h-4 w-4 mr-1" /> Configurar período
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80">
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Periodicidade</label>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_OPTIONS.map(opt => (
                      <button key={opt.days} type="button" onClick={() => setSIntervalDays(opt.days)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${sIntervalDays === opt.days ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input text-muted-foreground hover:bg-accent"}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Intervalo (dias)</label>
                  <Input type="number" min={1} value={sIntervalDays} onChange={e => setSIntervalDays(Math.max(1, parseInt(e.target.value) || 1))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Primeira reunião</label>
                  <Input type="date" value={sStartDate} onChange={e => setSStartDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Quantidade de reuniões</label>
                  <Input type="number" min={1} max={52} value={sMeetingCount} onChange={e => setSMeetingCount(Math.max(1, Math.min(52, parseInt(e.target.value) || 1)))} />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => setSettingsOpen(false)}>Cancelar</Button>
                  <Button type="button" size="sm" onClick={saveSettings}>Salvar</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      <div className="rounded-lg border border-border overflow-x-auto bg-card">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/60 border-b border-border">
              <th className="text-left font-semibold px-3 py-2 sticky left-0 bg-muted/60 z-10 min-w-[160px]">Membro</th>
              {dates.map(d => (
                <th key={d} className="text-center font-semibold px-2 py-2 text-xs whitespace-nowrap">{fmtDate(d)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map(m => (
              <tr key={m.id} className="border-b border-border last:border-b-0 hover:bg-accent/20">
                <td className="px-3 py-2 font-medium text-foreground sticky left-0 bg-card z-10">{m.name}</td>
                {dates.map(d => {
                  const key = `${m.id}|${d}`;
                  const rec = recordMap.get(key);
                  if (rec) {
                    const meta = STATUS_META[rec.status];
                    const cell = (
                      <button
                        type="button"
                        onClick={() => handleCellClick(m.id, d)}
                        disabled={!isAdmin}
                        title={rec.status === "FJ" && rec.justification ? `${meta.label}: ${rec.justification}` : meta.label}
                        className={`h-7 w-7 rounded-full text-[10px] font-bold flex items-center justify-center mx-auto ${meta.bg} ${meta.text} ${isAdmin ? "hover:opacity-80 cursor-pointer" : "cursor-default"}`}
                      >
                        {rec.status}
                      </button>
                    );
                    return (
                      <td key={d} className="px-2 py-2 text-center align-middle">
                        {rec.status === "FJ" && rec.justification ? (
                          <Popover>
                            <PopoverTrigger asChild>{cell}</PopoverTrigger>
                            <PopoverContent className="w-64 text-sm">
                              <p className="font-semibold text-foreground mb-1">Justificativa</p>
                              <p className="text-muted-foreground whitespace-pre-wrap">{rec.justification}</p>
                              {isAdmin && (
                                <div className="mt-3 flex justify-end">
                                  <Button size="sm" variant="outline" onClick={() => setJustifyModal({ open: true, personId: m.id, date: d, text: rec.justification })}>Editar</Button>
                                </div>
                              )}
                            </PopoverContent>
                          </Popover>
                        ) : cell}
                      </td>
                    );
                  }
                  return (
                    <td key={d} className="px-2 py-2 text-center align-middle">
                      <button
                        type="button"
                        onClick={() => handleCellClick(m.id, d)}
                        disabled={!isAdmin}
                        title={isAdmin ? "Marcar presença" : "Sem registro"}
                        className={`h-7 w-7 rounded-full border border-dashed border-border mx-auto block ${isAdmin ? "hover:border-primary hover:bg-primary/5 cursor-pointer" : "cursor-default opacity-50"}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Clique na bolinha para alternar: vazio → P → F → FJ (com justificativa) → vazio.
      </p>

      <Dialog open={justifyModal.open} onOpenChange={(o) => setJustifyModal(s => ({ ...s, open: o }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Falta Justificada</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveJustification(); }} className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Justificativa</label>
              <Textarea value={justifyModal.text} onChange={e => setJustifyModal(s => ({ ...s, text: e.target.value }))} rows={4} autoFocus placeholder="Motivo da falta..." />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setJustifyModal({ open: false, personId: "", date: "", text: "" })}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== Termômetro de Lead (Mercado) =====
function LeadThermometerTab() {
  const { leadThermometer, addLeadThermometer, updateLeadThermometer, deleteLeadThermometer } = useData();
  const { isAdmin } = useAuth();
  const items = useMemo(() => [...leadThermometer].sort((a, b) => a.position - b.position), [leadThermometer]);

  const [modal, setModal] = useState<{ open: boolean; item?: LeadThermometerItem | null }>({ open: false });
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [areaSize, setAreaSize] = useState("");
  const [type, setType] = useState("");

  const openCreate = () => { setModal({ open: true, item: null }); setName(""); setValue(""); setAreaSize(""); setType(""); };
  const openEdit = (item: LeadThermometerItem) => { setModal({ open: true, item }); setName(item.name); setValue(item.value); setAreaSize(item.areaSize); setType(item.type); };

  const save = async () => {
    if (!name.trim()) { toast.error("Nome obrigatório"); return; }
    if (modal.item) {
      await updateLeadThermometer({ ...modal.item, name: name.trim(), value: value.trim(), areaSize: areaSize.trim(), type: type.trim() });
      toast.success("Atualizado");
    } else {
      await addLeadThermometer({ name: name.trim(), value: value.trim(), areaSize: areaSize.trim(), type: type.trim() });
      toast.success("Lead adicionado");
    }
    setModal({ open: false, item: null });
  };

  const remove = async (id: string, label: string) => {
    if (!confirm(`Remover o lead "${label}"?`)) return;
    await deleteLeadThermometer(id);
    toast.success("Removido");
  };

  return (
    <div>
      {isAdmin && (
        <div className="flex justify-end mb-3">
          <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Novo lead</Button>
        </div>
      )}
      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <div className="bg-primary/10 px-4 py-2.5 text-center text-sm font-semibold text-foreground border-b border-border">
          Termômetro de Lead
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60 text-foreground border-b border-border">
                <th className="text-left font-semibold px-3 py-2 w-[24%]">Nome</th>
                <th className="text-left font-semibold px-3 py-2 w-[18%]">Valor +-</th>
                <th className="text-left font-semibold px-3 py-2 w-[14%]">m²</th>
                <th className="text-left font-semibold px-3 py-2">Tipo</th>
                {isAdmin && <th className="w-16 px-2 py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} className="text-center text-muted-foreground px-3 py-8">
                    Nenhum lead ainda.
                  </td>
                </tr>
              )}
              {items.map(item => (
                <tr key={item.id} className="border-b border-border last:border-b-0 hover:bg-accent/30 transition-colors">
                  <td className="px-3 py-2.5 font-medium text-foreground">{item.name}</td>
                  <td className="px-3 py-2.5 text-foreground">{item.value || "—"}</td>
                  <td className="px-3 py-2.5 text-foreground">{item.areaSize || "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{item.type || "—"}</td>
                  {isAdmin && (
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEdit(item)} className="p-1.5 hover:bg-accent rounded text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => remove(item.id, item.name)} className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={modal.open} onOpenChange={(o) => setModal({ open: o, item: null })}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{modal.item ? "Editar lead" : "Novo lead"}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: COTUCA" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Valor +-</label>
                <Input value={value} onChange={e => setValue(e.target.value)} placeholder="Ex: 13k" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">m²</label>
                <Input value={areaSize} onChange={e => setAreaSize(e.target.value)} placeholder="Ex: 100m²" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo</label>
              <Input value={type} onChange={e => setType(e.target.value)} placeholder="Ex: arq, design, eletrico, hidro" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setModal({ open: false, item: null })}>Cancelar</Button>
              <Button type="submit">{modal.item ? "Salvar" : "Adicionar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== Quadro CB (kanban: estacionamento + uma coluna por membro) =====
function KanbanTab({ area }: { area: AreaKey }) {
  const { people, parkingItems, addParkingItem, moveParkingItem, deleteParkingItem, updateParkingItem } = useData();
  const { isAdmin } = useAuth();

  const members = useMemo(() => people.filter(p => p.area === area), [people, area]);
  const items = useMemo(() => parkingItems.filter(p => p.area === area), [parkingItems, area]);

  const [modal, setModal] = useState<{ open: boolean; item?: ParkingItem | null }>({ open: false });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");

  const openCreate = () => { setModal({ open: true, item: null }); setTitle(""); setDescription(""); setDate(""); };
  const openEdit = (item: ParkingItem) => { setModal({ open: true, item }); setTitle(item.title); setDescription(item.description); setDate(item.date || ""); };

  const save = async () => {
    if (!title.trim()) { toast.error("Título obrigatório"); return; }
    if (!date) { toast.error("Data obrigatória"); return; }
    if (modal.item) {
      await updateParkingItem({ ...modal.item, title: title.trim(), description: description.trim(), date });
      toast.success("Atualizado");
    } else {
      await addParkingItem(area, title.trim(), date, description.trim());
      toast.success("Card criado");
    }
    setModal({ open: false });
  };

  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  const onDragStart = (e: DragEvent, id: string) => {
    if (!isAdmin) { e.preventDefault(); return; }
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };
  const onDragOver = (e: DragEvent, col: string) => { if (!isAdmin) return; e.preventDefault(); setOverCol(col); };
  const onDrop = (e: DragEvent, personId: string | null) => {
    e.preventDefault();
    setOverCol(null);
    if (!isAdmin) return;
    const id = dragId || e.dataTransfer.getData("text/plain");
    if (!id) return;
    const item = items.find(i => i.id === id);
    if (!item) return;
    if (item.personId === personId) { setDragId(null); return; }
    moveParkingItem(id, personId);
    setDragId(null);
  };

  const columnItems = (personId: string | null) =>
    items.filter(i => i.personId === personId).sort((a, b) => a.position - b.position);

  const Column = ({ personId, title: colTitle, accent }: { personId: string | null; title: string; accent?: boolean }) => {
    const colKey = personId ?? "__park";
    const colItems = columnItems(personId);
    return (
      <div
        onDragOver={(e) => onDragOver(e, colKey)}
        onDragLeave={() => setOverCol(null)}
        onDrop={(e) => onDrop(e, personId)}
        className={`w-52 shrink-0 flex flex-col rounded-lg border ${overCol === colKey ? "border-primary bg-primary/5" : "border-border bg-muted/30"} transition-colors`}
      >
        <div className={`px-4 py-3 border-b ${accent ? "bg-card border-primary/30" : "border-border"} rounded-t-lg flex items-center justify-between`}>
          <span className="text-sm font-semibold text-foreground truncate">{colTitle}</span>
          <span className="text-xs text-muted-foreground">{colItems.length}</span>
        </div>
        <div className="flex-1 p-3 flex flex-col gap-3 min-h-[160px]">
          {accent && isAdmin && (
            <button
              onClick={openCreate}
              className="w-full flex items-center justify-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground border border-dashed border-border hover:border-primary/50 rounded-lg py-2 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> nova demanda
            </button>
          )}
          {colItems.map(item => (
            <div
              key={item.id}
              draggable={isAdmin}
              onDragStart={(e) => onDragStart(e, item.id)}
              onDragEnd={() => setDragId(null)}
              onClick={() => isAdmin && openEdit(item)}
              className={`group bg-card border border-border rounded-lg p-4 text-sm shadow-sm hover:border-primary/50 transition-colors ${isAdmin ? "cursor-grab active:cursor-grabbing" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-foreground flex-1 leading-snug">{item.title}</span>
                {isAdmin && (
                  <button onClick={(e) => { e.stopPropagation(); deleteParkingItem(item.id); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {item.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{item.description}</p>}
              {item.date && (
                <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded"
                  style={{ backgroundColor: `${AREAS.find(a => a.key === area)?.color}22`, color: AREAS.find(a => a.key === area)?.color }}>
                  {new Date(item.date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-thin">
        <Column personId={null} title="Demandas" accent />
        {members.map(m => (
          <Column key={m.id} personId={m.id} title={m.name} />
        ))}
        {members.length === 0 && (
          <div className="text-xs text-muted-foreground px-3 py-6">
            Nenhum membro vinculado a essa área. Atribua membros em Pessoas → Membros.
          </div>
        )}
      </div>

      <Dialog open={modal.open} onOpenChange={(o) => setModal({ open: o, item: null })}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{modal.item ? "Editar card" : "Novo card"}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Título</label>
              <Input value={title} onChange={e => setTitle(e.target.value)} autoFocus />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Data</label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Descrição</label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
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