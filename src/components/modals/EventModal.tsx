import { useState, useEffect } from "react";
import { useData } from "@/contexts/DataContext";
import type { CalendarEvent } from "@/contexts/DataContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
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
  const { addEvent, updateEvent } = useData();

  const [form, setForm] = useState({
    title: "", date: defaultDate || "", time: "10:00", end_time: "",
    type: "event", description: "",
  });

  useEffect(() => {
    if (event) {
      setForm({
        title: event.title, date: event.date, time: event.time,
        end_time: event.end_time, type: event.type, description: event.description,
      });
    } else {
      setForm({ title: "", date: defaultDate || "", time: "10:00", end_time: "", type: "event", description: "" });
    }
  }, [event, defaultDate, open]);

  const handleSave = () => {
    if (!form.title.trim()) { toast.error("Título é obrigatório"); return; }
    if (event) {
      updateEvent({ ...event, ...form });
      toast.success("Evento atualizado");
    } else {
      addEvent(form);
      toast.success("Evento criado");
    }
    onOpenChange(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSave();
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event ? "Editar Evento" : "Novo Evento"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Título *</label>
            <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Título do evento" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Descrição</label>
            <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} onKeyDown={handleTextareaKeyDown} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Data</label>
              <Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Início</label>
              <Input type="time" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Fim</label>
              <Input type="time" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo</label>
            <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="meeting">Reunião</option>
              <option value="event">Evento</option>
              <option value="delivery">Entrega</option>
            </select>
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
