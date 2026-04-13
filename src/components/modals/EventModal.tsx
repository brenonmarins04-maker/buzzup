import { useState, useEffect } from "react";
import { useData } from "@/contexts/DataContext";
import type { CalendarEvent } from "@/lib/mock-data";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: CalendarEvent | null;
  defaultDate?: string;
};

export default function EventModal({ open, onOpenChange, event, defaultDate }: Props) {
  const { allMembers, addEvent, updateEvent } = useData();

  const [form, setForm] = useState({
    name: "",
    date: defaultDate || "",
    time: "10:00",
    type: "meeting" as CalendarEvent["type"],
    participants: [] as string[],
    description: "",
  });

  useEffect(() => {
    if (event) {
      setForm({
        name: event.name,
        date: event.date,
        time: event.time,
        type: event.type,
        participants: event.participants,
        description: event.description,
      });
    } else {
      setForm({ name: "", date: defaultDate || "", time: "10:00", type: "meeting", participants: [], description: "" });
    }
  }, [event, defaultDate, open]);

  const handleSave = () => {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    if (event) {
      updateEvent({ ...event, ...form });
      toast.success("Evento atualizado");
    } else {
      addEvent(form);
      toast.success("Evento criado");
    }
    onOpenChange(false);
  };

  const toggleParticipant = (name: string) => {
    setForm(prev => ({
      ...prev,
      participants: prev.participants.includes(name) ? prev.participants.filter(a => a !== name) : [...prev.participants, name],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event ? "Editar Evento" : "Novo Evento"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome *</label>
            <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Nome do evento" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Descrição</label>
            <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Data</label>
              <Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Horário</label>
              <Input type="time" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as CalendarEvent["type"] }))} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="meeting">Reunião</option>
                <option value="event">Evento</option>
                <option value="delivery">Entrega</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Participantes</label>
            <div className="flex flex-wrap gap-1.5">
              {allMembers.map(m => (
                <button key={m} type="button" onClick={() => toggleParticipant(m)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${form.participants.includes(m) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input text-muted-foreground hover:bg-accent"}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{event ? "Salvar" : "Criar Evento"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
