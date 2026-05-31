import { useState, useMemo, useRef, useEffect, type DragEvent, type KeyboardEvent } from "react";
import { useData, type ParkingItem, type ParkingItemStatus, type LeadThermometerItem, type AttendanceStatus } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { AREAS, type AreaKey, getAreaLabel } from "@/lib/areas";
import { Plus, ExternalLink, Pencil, Trash2, X, Settings, ChevronDown, ChevronUp, Circle, CheckCircle2 } from "lucide-react";
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
    { v: "notas", label: "Links úteis" },
    { v: "presencas", label: "Controle de Presenças" },
    ...(area === "mercado" ? [{ v: "termometro" as Tab, label: "Termômetro de Lead" }] : []),
  ];

  return (
    <div className="animate-fade-in space-y-5">
      <div
        className="rounded-xl border-2 px-5 py-4 flex items-center gap-3"
        style={{
          backgroundColor: `${meta.color}1A`,
          borderColor: meta.color,
        }}
      >
        <span className="h-3.5 w-3.5 rounded-full ring-2 ring-white/60" style={{ backgroundColor: meta.color }} />
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: meta.color }}>{label}</h1>
      </div>

      <div className="flex items-center gap-1 border-b-2 border-border">
        {tabs.map(t => (
          <button key={t.v} onClick={() => setTab(t.v as any)}
            style={tab === t.v ? { borderColor: meta.color, color: meta.color } : undefined}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors -mb-px ${tab === t.v ? "" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
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
  const { leadThermometer, addLeadThermometer, updateLeadThermometer, deleteLeadThermometer, workspaceId } = useData();
  const { isAdmin } = useAuth();
  const items = useMemo(() => [...leadThermometer].sort((a, b) => a.position - b.position), [leadThermometer]);

  // Editable column headers — persisted per workspace in localStorage.
  const COLS: { key: "name" | "value" | "areaSize" | "type"; defaultLabel: string; width?: string }[] = [
    { key: "name", defaultLabel: "Nome", width: "w-[28%]" },
    { key: "value", defaultLabel: "Valor +-", width: "w-[18%]" },
    { key: "areaSize", defaultLabel: "m²", width: "w-[14%]" },
    { key: "type", defaultLabel: "Tipo" },
  ];
  const storageKey = `lead-thermometer-headers:${workspaceId || "anon"}`;
  const [headers, setHeaders] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return { ...Object.fromEntries(COLS.map(c => [c.key, c.defaultLabel])), ...JSON.parse(raw) };
    } catch {}
    return Object.fromEntries(COLS.map(c => [c.key, c.defaultLabel]));
  });
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(headers)); } catch {}
  }, [headers, storageKey]);

  // Focus management: when we create a new row, we focus its name cell.
  const [focusRowId, setFocusRowId] = useState<string | null>(null);
  const nameRefs = useRef<Record<string, HTMLInputElement | null>>({});
  useEffect(() => {
    if (focusRowId && nameRefs.current[focusRowId]) {
      nameRefs.current[focusRowId]?.focus();
      setFocusRowId(null);
    }
  }, [focusRowId, items.length]);

  const commitCell = async (item: LeadThermometerItem, field: "name" | "value" | "areaSize" | "type", val: string) => {
    if (item[field] === val) return;
    await updateLeadThermometer({ ...item, [field]: val });
  };

  const addEmptyRow = async () => {
    await addLeadThermometer({ name: "", value: "", areaSize: "", type: "" });
    // Focus the newly created last row after React commits.
    setTimeout(() => {
      const last = Object.values(nameRefs.current).filter(Boolean).slice(-1)[0];
      last?.focus();
    }, 60);
  };

  const remove = async (id: string, label: string) => {
    if (!confirm(`Remover a linha "${label || "(sem nome)"}"?`)) return;
    await deleteLeadThermometer(id);
    toast.success("Removido");
  };

  return (
    <div>
      {isAdmin && (
        <div className="flex justify-end mb-3">
          <Button size="sm" onClick={addEmptyRow}><Plus className="h-4 w-4 mr-1" /> Nova linha</Button>
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
                {COLS.map(c => (
                  <th key={c.key} className={`text-left font-semibold px-1 py-1 ${c.width || ""}`}>
                    <input
                      value={headers[c.key]}
                      onChange={e => setHeaders(h => ({ ...h, [c.key]: e.target.value }))}
                      disabled={!isAdmin}
                      className="w-full bg-transparent px-2 py-1 rounded text-sm font-semibold outline-none hover:bg-background/60 focus:bg-background focus:ring-1 focus:ring-primary/40 disabled:cursor-default"
                    />
                  </th>
                ))}
                {isAdmin && <th className="w-16 px-2 py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} className="text-center text-muted-foreground px-3 py-8">
                    {isAdmin ? "Clique em \"Nova linha\" para começar." : "Nenhuma linha ainda."}
                  </td>
                </tr>
              )}
              {items.map((item, idx) => (
                <LeadRow
                  key={item.id}
                  item={item}
                  isAdmin={isAdmin}
                  isLast={idx === items.length - 1}
                  registerNameRef={(el) => { nameRefs.current[item.id] = el; }}
                  onCommit={commitCell}
                  onEnterFromName={async () => {
                    if (idx < items.length - 1) {
                      const nextId = items[idx + 1].id;
                      nameRefs.current[nextId]?.focus();
                    } else {
                      await addEmptyRow();
                    }
                  }}
                  onRemove={() => remove(item.id, item.name)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function LeadRow({
  item, isAdmin, registerNameRef, onCommit, onEnterFromName, onRemove,
}: {
  item: LeadThermometerItem;
  isAdmin: boolean;
  isLast: boolean;
  registerNameRef: (el: HTMLInputElement | null) => void;
  onCommit: (item: LeadThermometerItem, field: "name" | "value" | "areaSize" | "type", val: string) => Promise<void>;
  onEnterFromName: () => void | Promise<void>;
  onRemove: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [value, setValue] = useState(item.value);
  const [areaSize, setAreaSize] = useState(item.areaSize);
  const [type, setType] = useState(item.type);

  useEffect(() => { setName(item.name); }, [item.name]);
  useEffect(() => { setValue(item.value); }, [item.value]);
  useEffect(() => { setAreaSize(item.areaSize); }, [item.areaSize]);
  useEffect(() => { setType(item.type); }, [item.type]);

  const cellCls = "w-full bg-transparent px-2 py-1.5 rounded outline-none text-sm hover:bg-accent/40 focus:bg-background focus:ring-1 focus:ring-primary/40 disabled:cursor-default";

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>, fromName: boolean) => {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.currentTarget as HTMLInputElement).blur();
      if (fromName) onEnterFromName();
    }
  };

  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-accent/20 transition-colors">
      <td className="px-1 py-0.5">
        <input
          ref={registerNameRef}
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={() => onCommit(item, "name", name)}
          onKeyDown={(e) => onKeyDown(e, true)}
          disabled={!isAdmin}
          placeholder="Nome"
          className={`${cellCls} font-medium text-foreground`}
        />
      </td>
      <td className="px-1 py-0.5">
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          onBlur={() => onCommit(item, "value", value)}
          onKeyDown={(e) => onKeyDown(e, false)}
          disabled={!isAdmin}
          placeholder="—"
          className={`${cellCls} text-foreground`}
        />
      </td>
      <td className="px-1 py-0.5">
        <input
          value={areaSize}
          onChange={e => setAreaSize(e.target.value)}
          onBlur={() => onCommit(item, "areaSize", areaSize)}
          onKeyDown={(e) => onKeyDown(e, false)}
          disabled={!isAdmin}
          placeholder="—"
          className={`${cellCls} text-foreground`}
        />
      </td>
      <td className="px-1 py-0.5">
        <input
          value={type}
          onChange={e => setType(e.target.value)}
          onBlur={() => onCommit(item, "type", type)}
          onKeyDown={(e) => onKeyDown(e, false)}
          disabled={!isAdmin}
          placeholder="—"
          className={`${cellCls} text-muted-foreground`}
        />
      </td>
      {isAdmin && (
        <td className="px-2 py-1">
          <div className="flex items-center gap-1 justify-end">
            <button onClick={onRemove} className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        </td>
      )}
    </tr>
  );
}

// ===== Quadro CB (kanban: estacionamento + uma coluna por membro) =====
function KanbanTab({ area }: { area: AreaKey }) {
  const { people, parkingItems, addParkingItem, moveParkingItem, deleteParkingItem, updateParkingItem } = useData();
  const { isAdmin } = useAuth();
  const meta = AREAS.find(a => a.key === area)!;

  const members = useMemo(() => people.filter(p => p.area === area), [people, area]);
  const items = useMemo(() => parkingItems.filter(p => p.area === area), [parkingItems, area]);

  const [modal, setModal] = useState<{ open: boolean; item?: ParkingItem | null }>({ open: false });
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [personId, setPersonId] = useState<string>("");
  const [points, setPoints] = useState<number>(1);

  const openCreate = () => { setModal({ open: true, item: null }); setTitle(""); setDate(""); setPersonId(""); setPoints(1); };
  const openEdit = (item: ParkingItem) => { setModal({ open: true, item }); setTitle(item.title); setDate(item.date || ""); setPersonId(item.personId || ""); setPoints(item.points ?? 1); };

  const save = async () => {
    if (!title.trim()) { toast.error("Título obrigatório"); return; }
    if (!date) { toast.error("Data obrigatória"); return; }
    if (![1, 2, 3].includes(points)) { toast.error("Selecione os pontos"); return; }
    if (modal.item) {
      await updateParkingItem({ ...modal.item, title: title.trim(), date, personId: personId || null, points });
      toast.success("Atualizado");
    } else {
      await addParkingItem(area, title.trim(), date, "", points, personId || null);
      toast.success("Card criado");
    }
    setModal({ open: false });
  };

  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [doneOpen, setDoneOpen] = useState(false);
  const [completing, setCompleting] = useState<Set<string>>(new Set());

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
    // Dropping anywhere (Demandas/membro) reactivates a "done" card and moves it.
    if (item.status === "done") {
      updateParkingItem({ ...item, personId, status: "in-progress" });
    } else if (item.personId !== personId) {
      moveParkingItem(id, personId);
    }
    setDragId(null);
  };

  // Only "in-progress" cards live in their assigned column.
  const columnItems = (personId: string | null) =>
    items.filter(i => i.personId === personId && i.status !== "done").sort((a, b) => a.position - b.position);
  const doneItems = useMemo(() => items.filter(i => i.status === "done").sort((a, b) => a.position - b.position), [items]);

  const setStatus = (item: ParkingItem, status: ParkingItemStatus) => {
    if (item.status === status) return;
    if (status === "done") {
      // Trigger walking animation then move to done after 2s
      setCompleting(prev => {
        const n = new Set(prev);
        n.add(item.id);
        return n;
      });
      setTimeout(() => {
        updateParkingItem({ ...item, status: "done" });
        setDoneOpen(true);
        // Clear AFTER the card has unmounted from the in-progress column,
        // so removing the .demand-walking class doesn't cause a snap-back.
        setTimeout(() => {
          setCompleting(prev => {
            const n = new Set(prev);
            n.delete(item.id);
            return n;
          });
        }, 200);
      }, 2000);
      return;
    }
    updateParkingItem({ ...item, status });
  };

  const renderCard = (item: ParkingItem) => {
    const isDone = item.status === "done";
    const isCompleting = completing.has(item.id) && !isDone;
    const tint = isDone || isCompleting ? "#10B981" : "#F59E0B"; // green / orange
    return (
      <div
        key={item.id}
        draggable={isAdmin}
        onDragStart={(e) => onDragStart(e, item.id)}
        onDragEnd={() => setDragId(null)}
        className={`group bg-card border rounded-lg p-3 text-sm shadow-sm transition-colors ${isAdmin ? "cursor-grab active:cursor-grabbing" : ""} ${isCompleting ? "demand-walking" : ""}`}
        style={{ borderColor: `${tint}66`, backgroundColor: `${tint}10` }}
      >
        {/* Status toggle row */}
        {isAdmin && (
          <div className="flex items-center gap-1.5 mb-2.5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setStatus(item, "in-progress"); }}
              title="Em andamento"
              aria-label="Em andamento"
              className="h-5 w-5 rounded-full transition-all border-2"
              style={item.status === "in-progress" && !isCompleting
                ? { backgroundColor: "#F59E0B", borderColor: "#F59E0B", boxShadow: "0 2px 6px #F59E0B88" }
                : { backgroundColor: "transparent", borderColor: "#F59E0B" }}
            />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setStatus(item, "done"); }}
              title="Concluída"
              aria-label="Concluída"
              className="h-5 w-5 rounded-full transition-all border-2"
              style={item.status === "done" || isCompleting
                ? { backgroundColor: "#10B981", borderColor: "#10B981", boxShadow: "0 2px 6px #10B98188" }
                : { backgroundColor: "transparent", borderColor: "#10B981" }}
            />
            <button
              onClick={(e) => { e.stopPropagation(); deleteParkingItem(item.id); }}
              className="ml-auto text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              title="Excluir"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <div onClick={() => isAdmin && openEdit(item)} className={isAdmin ? "cursor-pointer" : ""}>
          <div className="flex items-start justify-between gap-2">
            <span className={`font-semibold leading-snug flex-1 ${isDone ? "text-muted-foreground line-through" : "text-foreground"}`}>{item.title}</span>
            {item.points ? (
              <span
                className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md text-white"
                style={{ backgroundColor: tint }}
                title={`${item.points} ${item.points === 1 ? "ponto" : "pontos"}`}
              >
                {item.points}p
              </span>
            ) : null}
          </div>
          {item.description && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-3">{item.description}</p>}
          {item.date && (
            <div
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md text-white"
              style={{ backgroundColor: tint }}
            >
              {new Date(item.date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const Column = ({ personId, title: colTitle, accent }: { personId: string | null; title: string; accent?: boolean }) => {
    const colKey = personId ?? "__park";
    const colItems = columnItems(personId);
    const isDemandsCol = accent;
    return (
      <div
        onDragOver={(e) => onDragOver(e, colKey)}
        onDragLeave={() => setOverCol(null)}
        onDrop={(e) => onDrop(e, personId)}
        className={`w-full flex flex-col rounded-lg border ${overCol === colKey ? "border-primary bg-primary/5" : "border-border bg-muted/30"} transition-colors`}
      >
        <div className={`px-4 py-3 border-b ${accent ? "bg-card border-primary/30" : "border-border"} rounded-t-lg flex items-center justify-between`}>
          <span className="text-sm font-semibold text-foreground truncate">{colTitle}</span>
          <span className="text-xs text-muted-foreground">{colItems.length}</span>
        </div>
        <div className="flex-1 p-3 flex flex-col gap-3 min-h-[160px]">
          {accent && (
            <button
              onClick={openCreate}
              className="w-full flex items-center justify-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground border border-dashed border-border hover:border-primary/50 rounded-lg py-2 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> nova demanda
            </button>
          )}
          {colItems.map(item => renderCard(item))}
        </div>
        {/* Concluídas — só aparece dentro da coluna "Demandas" */}
        {isDemandsCol && (
          <div className="border-t border-border bg-card/40 rounded-b-lg">
            <button
              type="button"
              onClick={() => setDoneOpen(o => !o)}
              className="w-full px-3 py-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
            >
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
                ) : (
                  doneItems.map(item => renderCard(item))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 pb-3">
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
        <DialogContent
          className="max-w-md overflow-hidden shadow-2xl bg-background"
          style={{
            background: `linear-gradient(160deg, color-mix(in srgb, ${meta.color} 35%, white) 0%, color-mix(in srgb, ${meta.color} 15%, white) 45%, white 100%)`,
          }}
        >
          <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: meta.color }} />
          <DialogHeader>
            <DialogTitle className="text-lg">{modal.item ? "Editar demanda" : "Nova demanda"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-col gap-4">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Título</label>
              <Input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Descreva a demanda" className="rounded-full h-11 px-4" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Responsável</label>
              {members.length === 0 ? (
                <div className="h-11 rounded-full border border-input bg-muted/30 px-4 flex items-center text-2xl">😞</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {members.map(p => {
                    const selected = personId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPersonId(selected ? "" : p.id)}
                        className="px-4 h-9 rounded-full text-sm font-medium transition-all border"
                        style={{
                          backgroundColor: selected ? meta.color : `${meta.color}10`,
                          color: selected ? "#fff" : "hsl(var(--foreground))",
                          borderColor: selected ? meta.color : `${meta.color}30`,
                          boxShadow: selected ? `0 4px 14px ${meta.color}55` : "none",
                        }}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Data <span className="text-destructive">*</span></label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded-full h-11 px-4" required />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Pontos <span className="text-destructive">*</span></label>
              <div className="flex gap-2">
                {[1, 2, 3].map(n => {
                  const selected = points === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPoints(n)}
                      className="flex-1 h-12 rounded-full text-base font-bold transition-all border"
                      style={{
                        backgroundColor: selected ? meta.color : `${meta.color}10`,
                        color: selected ? "#fff" : meta.color,
                        borderColor: selected ? meta.color : `${meta.color}30`,
                        boxShadow: selected ? `0 4px 14px ${meta.color}55` : "none",
                        transform: selected ? "translateY(-1px)" : "none",
                      }}
                    >
                      {n} {n === 1 ? "ponto" : "pontos"}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Somados na gamificação quando a demanda for concluída.</p>
            </div>
            <div className="flex items-center justify-between pt-2">
              {modal.item ? (
                <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive rounded-full" onClick={async () => { await deleteParkingItem(modal.item!.id); toast.success("Excluído"); setModal({ open: false, item: null }); }}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                </Button>
              ) : <div />}
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="rounded-full px-5" onClick={() => setModal({ open: false, item: null })}>Cancelar</Button>
                <Button type="submit" className="rounded-full px-5 text-white border-0 hover:opacity-90" style={{ backgroundColor: meta.color }}>
                  {modal.item ? "Salvar" : "Criar"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}