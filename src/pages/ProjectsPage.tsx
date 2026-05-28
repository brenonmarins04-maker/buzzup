import { useData, type Project, type LeadThermometerItem } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, X, Trash2, Pencil, ChevronDown } from "lucide-react";
import { useState, useMemo, useEffect, useRef } from "react";
import ProjectModal from "@/components/modals/ProjectModal";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const statusBadge: Record<string, { label: string; class: string }> = {
  active: { label: "Ativo", class: "bg-status-done/10 text-status-done" },
  completed: { label: "Concluído", class: "bg-muted text-muted-foreground" },
};

const PIPELINE_STATUSES: { value: string; label: string; class: string }[] = [
  { value: "em-execucao", label: "Em execução", class: "bg-emerald-600 text-white" },
  { value: "em-atraso", label: "Em atraso", class: "bg-orange-500 text-white" },
  { value: "em-pausa", label: "Em Pausa", class: "bg-teal-700 text-white" },
  { value: "csat", label: "Coleta de CSAT", class: "bg-pink-200 text-pink-900" },
  { value: "juridico", label: "Problema jurídico", class: "bg-red-600 text-white" },
  { value: "prestes", label: "Prestes a começar", class: "bg-green-100 text-green-800 border border-green-400" },
  { value: "externo", label: "Externo", class: "bg-black text-white" },
];
const pipelineMeta = (v: string) => PIPELINE_STATUSES.find(s => s.value === v);

export default function ProjectsPage() {
  const { projects, deleteProject } = useData();
  const { isAdmin } = useAuth();
  const [modal, setModal] = useState<{ open: boolean; project?: any }>({ open: false });
  const [tab, setTab] = useState<"active" | "completed" | "planilha">("active");
  const [deleting, setDeleting] = useState<{ open: boolean; id: string; title: string }>({ open: false, id: "", title: "" });

  const filtered = tab === "planilha" ? [] : projects.filter(p => p.status === tab);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Projetos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tab === "planilha" ? `${projects.length} projetos` : `${filtered.length} projetos`}
          </p>
        </div>
        {isAdmin && tab !== "planilha" && (
          <button onClick={() => setModal({ open: true })} className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" /> Novo Projeto
          </button>
        )}
      </div>

      <div className="flex bg-muted rounded-md p-0.5 w-fit">
        <button onClick={() => setTab("active")} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${tab === "active" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>Ativos</button>
        <button onClick={() => setTab("completed")} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${tab === "completed" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>Concluídos</button>
        <button onClick={() => setTab("planilha")} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${tab === "planilha" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>Planilha</button>
      </div>

      {tab !== "planilha" && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((project) => {
          const st = statusBadge[project.status];
          return (
            <div key={project.id} className="bg-card border border-border rounded-lg p-5 hover:shadow-md transition-all cursor-pointer flex flex-col gap-4 relative group"
              onClick={() => setModal({ open: true, project })}>
              <button onClick={e => { e.stopPropagation(); setDeleting({ open: true, id: project.id, title: project.name }); }}
                className="absolute top-2 right-2 h-6 w-6 rounded-full bg-destructive/10 text-destructive flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20">
                <X className="h-3.5 w-3.5" />
              </button>
              <div className="flex items-start justify-between pr-6">
                <h2 className="text-base font-semibold text-foreground">{project.name}</h2>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${st?.class}`}>{st?.label}</span>
              </div>
              {project.description && <p className="text-xs text-muted-foreground line-clamp-2">{project.description}</p>}
              {project.members.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {project.members.map(m => (
                    <span key={m.id} className="text-[10px] bg-accent text-foreground px-2 py-0.5 rounded-full">{m.name}</span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground col-span-full text-center py-8">Nenhum projeto</p>}
      </div>}

      {tab === "planilha" && <ProjectsSpreadsheet />}

      <ProjectModal open={modal.open} onOpenChange={o => setModal({ open: o })} project={modal.project} />
      <DeleteConfirmDialog open={deleting.open} onOpenChange={o => setDeleting(p => ({ ...p, open: o }))}
        title={deleting.title} onConfirm={() => { deleteProject(deleting.id); toast.success("Projeto excluído"); }} />
    </div>
  );
}

// ============== Spreadsheet ==============
function ProjectsSpreadsheet() {
  const { projects, people, addProject, updateProject, deleteProject } = useData();
  const { isAdmin } = useAuth();

  const sorted = useMemo(() => [...projects].sort((a, b) => a.name.localeCompare(b.name)), [projects]);

  // Empty placeholder rows so the table feels like a sheet
  const emptyRows = Math.max(0, 6 - sorted.length);

  // Stats
  const totalPeople = people.length;
  const peopleInProjectsCount = useMemo(() => {
    const set = new Set<string>();
    projects.forEach(p => {
      if (p.managerId) set.add(p.managerId);
      p.members.forEach(m => set.add(m.id));
    });
    return set.size;
  }, [projects]);
  const peopleInTwoPlus = useMemo(() => {
    const counts = new Map<string, number>();
    projects.forEach(p => {
      const ids = new Set<string>();
      if (p.managerId) ids.add(p.managerId);
      p.members.forEach(m => ids.add(m.id));
      ids.forEach(id => counts.set(id, (counts.get(id) || 0) + 1));
    });
    let c = 0;
    counts.forEach(v => { if (v >= 2) c++; });
    return c;
  }, [projects]);
  const pct = totalPeople > 0 ? Math.round((peopleInProjectsCount / totalPeople) * 100) : 0;

  const createBlank = async (name: string) => {
    if (!name.trim()) return;
    await addProject({
      name: name.trim(), description: "", color: "#888888", status: "active",
      memberIds: [], managerId: null, pipelineStatus: "", startDate: "", endContract: "", endDelivered: "",
    });
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Membros em projetos" value={`${peopleInProjectsCount}/${totalPeople}`} sub={`${pct}% da empresa`} />
        <StatCard label="Em 2+ projetos" value={`${peopleInTwoPlus}`} sub="pessoas alocadas em vários projetos" />
        <StatCard label="Projetos cadastrados" value={`${projects.length}`} sub="total na planilha" />
      </div>

      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <div className="bg-[#0B2A5B] text-white text-center font-semibold py-3 text-base">Projetos Rodando</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[#0B2A5B] text-white">
                <Th>Nome do Projeto</Th>
                <Th>Gerente</Th>
                <Th className="w-[34%]">Assessores</Th>
                <Th>Status do projeto</Th>
                <Th>Nº de membros</Th>
                <Th>Data inicial</Th>
                <Th>Data Final Contrato</Th>
                <Th>Data Final Entregue</Th>
                {isAdmin && <Th></Th>}
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <ProjectRow key={p.id} project={p} people={people} canEdit={isAdmin}
                  onChange={(np) => updateProject(np)}
                  onDelete={() => { if (confirm(`Excluir o projeto "${p.name}"?`)) deleteProject(p.id); }}
                />
              ))}
              {Array.from({ length: emptyRows }).map((_, i) => (
                <BlankRow key={`empty-${i}`} canEdit={isAdmin} onCreate={createBlank} cols={isAdmin ? 9 : 8} />
              ))}
              {isAdmin && (
                <BlankRow canEdit onCreate={createBlank} cols={9} highlight />
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ProjectsThermometer />
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1 text-foreground">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-2 py-2 text-center font-semibold border border-white/20 ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`border border-border align-middle ${className}`}>{children}</td>;
}

function ProjectRow({ project, people, canEdit, onChange, onDelete }: {
  project: Project; people: { id: string; name: string }[]; canEdit: boolean;
  onChange: (p: Project) => void; onDelete: () => void;
}) {
  const memberCount = (project.managerId ? 1 : 0) + project.members.length;
  const status = pipelineMeta(project.pipelineStatus);

  return (
    <tr className="hover:bg-accent/30">
      <Td className="bg-orange-100 text-foreground font-semibold text-center px-2 py-1">
        <InlineText value={project.name} disabled={!canEdit} onChange={(v) => onChange({ ...project, name: v })} />
      </Td>
      <Td className="bg-muted/40 px-1">
        <PersonPicker value={project.managerId ? [project.managerId] : []} people={people} multi={false} disabled={!canEdit}
          onChange={(ids) => onChange({ ...project, managerId: ids[0] || null })} placeholder="—" />
      </Td>
      <Td className="bg-muted/30 px-1">
        <PersonPicker value={project.members.map(m => m.id)} people={people} multi disabled={!canEdit}
          onChange={(ids) => onChange({ ...project, members: people.filter(p => ids.includes(p.id)) as any })} placeholder="—" />
      </Td>
      <Td className="px-1 text-center">
        <StatusPicker value={project.pipelineStatus} disabled={!canEdit} onChange={(v) => onChange({ ...project, pipelineStatus: v })} />
      </Td>
      <Td className="text-center font-medium">{memberCount}</Td>
      <Td className="px-1">
        <DateCell value={project.startDate} disabled={!canEdit} onChange={(v) => onChange({ ...project, startDate: v })} />
      </Td>
      <Td className="px-1">
        <DateCell value={project.endContract} disabled={!canEdit} onChange={(v) => onChange({ ...project, endContract: v })} />
      </Td>
      <Td className="px-1">
        <DateCell value={project.endDelivered} disabled={!canEdit} onChange={(v) => onChange({ ...project, endDelivered: v })} />
      </Td>
      {canEdit && (
        <Td className="text-center px-1">
          <button onClick={onDelete} className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </Td>
      )}
    </tr>
  );
}

function BlankRow({ canEdit, onCreate, cols, highlight }: { canEdit: boolean; onCreate: (name: string) => void; cols: number; highlight?: boolean }) {
  const [name, setName] = useState("");
  return (
    <tr>
      <Td className={`${highlight ? "bg-orange-200/70" : "bg-orange-100/40"} text-center px-2 py-1`}>
        {canEdit ? (
          <input
            value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && name.trim()) { onCreate(name); setName(""); } }}
            placeholder={highlight ? "+ Novo projeto..." : ""}
            className="w-full bg-transparent text-center text-xs font-semibold outline-none placeholder:text-muted-foreground"
          />
        ) : <span className="text-muted-foreground">—</span>}
      </Td>
      {Array.from({ length: cols - 1 }).map((_, i) => (
        <Td key={i} className="bg-muted/20 h-8">&nbsp;</Td>
      ))}
    </tr>
  );
}

// ============== Inline cell controls ==============
function InlineText({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input
      value={v} onChange={e => setV(e.target.value)}
      onBlur={() => { if (v !== value) onChange(v); }}
      onKeyDown={e => { if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); } }}
      disabled={disabled}
      className="w-full bg-transparent text-center outline-none disabled:cursor-default px-1"
    />
  );
}

function DateCell({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  // Display dd/mm/yy from ISO YYYY-MM-DD
  const display = useMemo(() => {
    if (!value) return "";
    const [y, m, d] = value.split("-");
    if (!y || !m || !d) return value;
    return `${d}/${m}/${y.slice(2)}`;
  }, [value]);

  return (
    <div className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) { ref.current?.showPicker?.(); ref.current?.focus(); } }}
        className="w-full text-center px-1 py-1.5 text-xs hover:bg-accent/40 rounded disabled:cursor-default"
      >
        {display || <span className="text-muted-foreground">—</span>}
      </button>
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 pointer-events-none"
      />
    </div>
  );
}

function StatusPicker({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const meta = pipelineMeta(value);
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button disabled={disabled} className={`inline-flex items-center justify-center gap-1 w-full px-2 py-1 rounded text-[11px] font-semibold transition-all ${meta ? meta.class : "bg-muted text-muted-foreground"} ${disabled ? "cursor-default" : "hover:opacity-90"}`}>
          <span className="truncate">{meta?.label || "—"}</span>
          {!disabled && <ChevronDown className="h-3 w-3 opacity-70 shrink-0" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        <button onClick={() => { onChange(""); setOpen(false); }}
          className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent text-muted-foreground">— Limpar —</button>
        {PIPELINE_STATUSES.map(s => (
          <button key={s.value} onClick={() => { onChange(s.value); setOpen(false); }}
            className="w-full px-2 py-1.5 rounded hover:bg-accent text-left flex items-center">
            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${s.class}`}>{s.label}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function PersonPicker({ value, people, multi, onChange, disabled, placeholder }: {
  value: string[]; people: { id: string; name: string }[]; multi: boolean;
  onChange: (ids: string[]) => void; disabled?: boolean; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = people.filter(p => value.includes(p.id));
  const filtered = people.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  const toggle = (id: string) => {
    if (!multi) { onChange([id]); setOpen(false); return; }
    onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id]);
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
      <PopoverTrigger asChild>
        <button disabled={disabled} className={`w-full px-2 py-1 rounded text-xs text-center hover:bg-accent/40 disabled:cursor-default min-h-[28px] flex items-center justify-center gap-1 flex-wrap ${disabled ? "" : "cursor-pointer"}`}>
          {selected.length === 0 ? (
            <span className="text-muted-foreground">{placeholder || "—"}</span>
          ) : multi ? (
            <>
              {selected.map(p => (
                <span key={p.id} className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px] font-medium">{p.name}</span>
              ))}
            </>
          ) : (
            <span className="font-medium text-foreground">{selected[0].name}</span>
          )}
          {!disabled && <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar pessoa..." className="h-8 mb-2" />
        <div className="max-h-56 overflow-y-auto flex flex-col">
          {!multi && (
            <button onClick={() => { onChange([]); setOpen(false); }} className="text-xs text-left px-2 py-1.5 rounded hover:bg-accent text-muted-foreground">— Limpar —</button>
          )}
          {filtered.length === 0 && <p className="text-xs text-muted-foreground px-2 py-2">Nenhuma pessoa</p>}
          {filtered.map(p => (
            <button key={p.id} onClick={() => toggle(p.id)}
              className={`text-xs text-left px-2 py-1.5 rounded hover:bg-accent flex items-center gap-2 ${value.includes(p.id) ? "bg-primary/10 text-primary font-medium" : ""}`}>
              {multi && <span className={`h-3 w-3 rounded-sm border ${value.includes(p.id) ? "bg-primary border-primary" : "border-border"}`} />}
              {p.name}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============== Lead Thermometer (shared with Mercado) ==============
function ProjectsThermometer() {
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
          Termômetro de Lead — Projetos
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
                <tr><td colSpan={isAdmin ? 5 : 4} className="text-center text-muted-foreground px-3 py-8">Nenhum lead ainda.</td></tr>
              )}
              {items.map(item => (
                <tr key={item.id} className="border-b border-border last:border-b-0 hover:bg-accent/30">
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
