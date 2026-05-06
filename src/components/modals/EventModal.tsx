import { useState, useEffect } from "react";
import { useData } from "@/contexts/DataContext";
import type { CalendarEvent } from "@/contexts/DataContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import TeamSelector from "@/components/TeamSelector";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: CalendarEvent | null;
  defaultDate?: string;
};

export default function EventModal({ open, onOpenChange, event, defaultDate }: Props) {
  const { addEvent, updateEvent } = useData();

  const [form, setForm] = useState({
    title: "", date: defaultDate || "", type: "event", description: "", teamId: null as string | null,
  });

  useEffect(() => {
    if (event) {
      setForm({ title: event.title, date: event.date, type: event.type, description: event.description, teamId: event.teamId });
    } else {
      setForm({ title: "", date: defaultDate || "", type: "event", description: "", teamId: null });
    }
  }, [event, defaultDate, open]);

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

  const typeLabels: Record<string, { new: string; edit: string }> = {
    meeting: { new: "Nova Reunião", edit: "Editar Reunião" },
    event: { new: "Novo Evento", edit: "Editar Evento" },
    delivery: { new: "Nova Entrega", edit: "Editar Entrega" },
    reminder: { new: "Novo Lembrete", edit: "Editar Lembrete" },
  };
  const headerLabel = event ? (typeLabels[form.type]?.edit ?? "Editar Evento") : (typeLabels[form.type]?.new ?? "Novo Evento");

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
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="meeting">Reunião</option>
                <option value="event">Evento</option>
                <option value="delivery">Entrega</option>
                <option value="reminder">Lembrete</option>
              </select>
            </div>
          </div>
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
