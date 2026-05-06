import { useState, useEffect } from "react";
import { useData } from "@/contexts/DataContext";
import type { CalendarEvent } from "@/contexts/DataContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import TeamSelector from "@/components/TeamSelector";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Pencil, Trash2, Check, X, Settings2 } from "lucide-react";

const TYPE_PALETTE = [
  "#2E9E6E", // verde
  "#B5651D", // marrom/âmbar
  "#7A4FBF", // roxo
  "#D14A8A", // rosa
  "#1F8FB3", // turquesa
  "#C0392B", // vermelho médio
  "#5C7CFA", // azul-roxo
  "#E0A82E", // amarelo escuro
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: CalendarEvent | null;
  defaultDate?: string;
};

export default function EventModal({ open, onOpenChange, event, defaultDate }: Props) {
  const { addEvent, updateEvent, eventTypes, addEventType, updateEventType, deleteEventType } = useData();
  const { isAdmin } = useAuth();
  const [manageOpen, setManageOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const defaultType = eventTypes[0]?.name || "Evento";

  const [form, setForm] = useState({
    title: "", date: defaultDate || "", type: defaultType, description: "", teamId: null as string | null,
  });

  useEffect(() => {
    if (event) {
      setForm({ title: event.title, date: event.date, type: event.type, description: event.description, teamId: event.teamId });
    } else {
      setForm({ title: "", date: defaultDate || "", type: defaultType, description: "", teamId: null });
    }
  }, [event, defaultDate, open, defaultType]);

  const handleSave = () => {
    if (!form.title.trim()) { toast.error("Título é obrigatório"); return; }
    if (!form.date) { toast.error("Data é obrigatória"); return; }
    if (event) {
      updateEvent({ ...event, ...form });
      toast.success("Evento atualizado");
    } else {
      addEvent(form);
      toast.success("Evento criado");
    }
    onOpenChange(false);
  };

  const typeLabel = form.type || "Evento";
  const headerLabel = event ? `Editar ${typeLabel}` : `Novo ${typeLabel}`;

  const handleAddType = async () => {
    const name = newTypeName.trim();
    if (!name) return;
    if (eventTypes.some(t => t.name.toLowerCase() === name.toLowerCase())) { toast.error("Tipo já existe"); return; }
    const usedColors = new Set(eventTypes.map(t => t.color));
    const color = TYPE_PALETTE.find(c => !usedColors.has(c)) || TYPE_PALETTE[eventTypes.length % TYPE_PALETTE.length];
    await addEventType({ name, color });
    setNewTypeName("");
  };
  const handleSaveEdit = async (id: string) => {
    const name = editingName.trim();
    if (!name) return;
    const t = eventTypes.find(x => x.id === id); if (!t) return;
    const oldName = t.name;
    await updateEventType({ ...t, name });
    if (form.type === oldName) setForm(p => ({ ...p, type: name }));
    setEditingId(null); setEditingName("");
  };
  const handleDeleteType = async (id: string) => {
    const t = eventTypes.find(x => x.id === id); if (!t) return;
    if (eventTypes.length <= 1) { toast.error("Mantenha ao menos um tipo"); return; }
    await deleteEventType(id);
    if (form.type === t.name) setForm(p => ({ ...p, type: eventTypes.find(x => x.id !== id)?.name || "Evento" }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{headerLabel}</DialogTitle></DialogHeader>
        <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Título *</label>
            <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Título do evento" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Descrição</label>
            <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSave(); } }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Data *</label>
              <Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-muted-foreground">Tipo</label>
                {isAdmin && (
                  <button type="button" onClick={() => setManageOpen(s => !s)}
                    className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <Settings2 className="h-3 w-3" /> Gerenciar
                  </button>
                )}
              </div>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                {eventTypes.length === 0 && <option value="Evento">Evento</option>}
                {eventTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </div>
          </div>
          {manageOpen && isAdmin && (
            <div className="rounded-md border border-border bg-muted/30 p-3 flex flex-col gap-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Tipos de evento</p>
              {eventTypes.map(t => (
                <div key={t.id} className="flex items-center gap-2">
                  {editingId === t.id ? (
                    <>
                      <input type="color" value={t.color} onChange={async (e) => { await updateEventType({ ...t, color: e.target.value }); }}
                        className="h-8 w-8 rounded border border-input bg-background cursor-pointer" />
                      <Input value={editingName} onChange={e => setEditingName(e.target.value)} className="h-8 text-sm"
                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSaveEdit(t.id); } }} />
                      <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleSaveEdit(t.id)}><Check className="h-3.5 w-3.5" /></Button>
                      <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setEditingId(null); setEditingName(""); }}><X className="h-3.5 w-3.5" /></Button>
                    </>
                  ) : (
                    <>
                      <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                      <span className="text-sm flex-1">{t.name}</span>
                      <button type="button" className="text-muted-foreground hover:text-foreground p-1" onClick={() => { setEditingId(t.id); setEditingName(t.name); }}><Pencil className="h-3 w-3" /></button>
                      <button type="button" className="text-muted-foreground hover:text-destructive p-1" onClick={() => handleDeleteType(t.id)}><Trash2 className="h-3 w-3" /></button>
                    </>
                  )}
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <Input value={newTypeName} onChange={e => setNewTypeName(e.target.value)} placeholder="Novo tipo..." className="h-8 text-sm"
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddType(); } }} />
                <Button type="button" size="sm" variant="outline" className="h-8" onClick={handleAddType}><Plus className="h-3 w-3" /></Button>
              </div>
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Equipe</label>
            <TeamSelector selectedId={form.teamId} onChange={(id) => setForm(p => ({ ...p, teamId: id }))} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit">{event ? "Salvar" : "Criar Evento"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
