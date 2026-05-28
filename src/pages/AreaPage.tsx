import { useState, useMemo, type DragEvent } from "react";
import { useData, type ParkingItem } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { AREAS, type AreaKey, getAreaLabel } from "@/lib/areas";
import { Plus, ExternalLink, Pencil, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type Props = { area: AreaKey };

export default function AreaPage({ area }: Props) {
  const [tab, setTab] = useState<"notas" | "quadro">("quadro");
  const label = getAreaLabel(area);
  const meta = AREAS.find(a => a.key === area)!;

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-center gap-3">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: meta.color }} />
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">{label}</h1>
      </div>

      <div className="flex items-center gap-1 border-b border-border">
        {[
          { v: "quadro", label: "Quadro CB" },
          { v: "notas", label: "Notas" },
        ].map(t => (
          <button key={t.v} onClick={() => setTab(t.v as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${tab === t.v ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "notas" ? <NotesTab area={area} /> : <KanbanTab area={area} />}
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