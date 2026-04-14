import { useState, useEffect } from "react";
import { useData, type GeneralItem } from "@/contexts/DataContext";
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
  item?: GeneralItem | null;
  defaultDate?: string;
};

export default function GeneralItemModal({ open, onOpenChange, item, defaultDate }: Props) {
  const { addGeneralItem, updateGeneralItem } = useData();
  const [form, setForm] = useState({
    title: "", description: "", date: defaultDate || "", time: "10:00",
    type: "reminder" as GeneralItem["type"],
  });

  useEffect(() => {
    if (item) {
      setForm({ title: item.title, description: item.description, date: item.date, time: item.time, type: item.type });
    } else {
      setForm({ title: "", description: "", date: defaultDate || "", time: "10:00", type: "reminder" });
    }
  }, [item, defaultDate, open]);

  const handleSave = () => {
    if (!form.title.trim()) { toast.error("Título é obrigatório"); return; }
    if (item) {
      updateGeneralItem({ ...item, ...form });
      toast.success("Item atualizado");
    } else {
      addGeneralItem(form);
      toast.success("Item criado");
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? "Editar Item" : "Novo Item"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Título *</label>
            <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Título" />
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
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Horário</label>
              <Input type="time" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as GeneralItem["type"] }))} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="reminder">Lembrete</option>
                <option value="event">Evento</option>
                <option value="note">Anotação</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit">{item ? "Salvar" : "Criar Item"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
