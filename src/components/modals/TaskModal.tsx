import { useState, useEffect, useRef } from "react";
import { useData } from "@/contexts/DataContext";
import type { Task } from "@/contexts/DataContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { useFormMemory } from "@/hooks/useFormMemory";
import TeamPersonSelector from "@/components/TeamPersonSelector";
import TeamSelector from "@/components/TeamSelector";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  defaultDate?: string;
  lockedTeamId?: string | null;
};

export default function TaskModal({ open, onOpenChange, task, defaultDate, lockedTeamId }: Props) {
  const { people, addTask, updateTask } = useData();
  const { teams } = useData();
  const { memory, remember } = useFormMemory();
  const titleRef = useRef<HTMLInputElement>(null);

  const makeBlank = () => ({
    title: "", description: "", responsibleIds: [] as string[],
    team: memory.lastTeam || "",
    teamId: lockedTeamId !== undefined ? lockedTeamId : ((memory.lastTeamId as string | null) ?? null),
    deadline: defaultDate || "",
    status: "not-started", priority: "medium",
    checklist: [] as { text: string; checked: boolean }[],
    points: 0,
  });

  const [form, setForm] = useState(makeBlank);
  const [newCheckItem, setNewCheckItem] = useState("");

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title, description: task.description,
        responsibleIds: task.responsible.map(r => r.id), team: task.team,
        teamId: task.teamId,
        deadline: task.deadline, status: task.status,
        priority: task.priority, checklist: task.checklist || [],
        points: task.points ?? 0,
      });
    } else {
      setForm(makeBlank());
    }
    setNewCheckItem("");
  }, [task, defaultDate, open, lockedTeamId]);

  const handleSave = () => {
    if (!form.title.trim()) { toast.error("Título é obrigatório"); return; }
    if (!form.deadline) { toast.error("Prazo é obrigatório"); return; }
    remember({ lastTeam: form.team, lastTeamId: form.teamId });
    if (task) {
      updateTask({
        ...task, title: form.title, description: form.description, team: form.team,
        teamId: form.teamId,
        responsible: people.filter(p => form.responsibleIds.includes(p.id)),
        deadline: form.deadline, status: form.status, priority: form.priority, checklist: form.checklist,
        points: form.points,
      });
      toast.success("Tarefa atualizada");
      onOpenChange(false);
    } else {
      addTask({ ...form });
      toast.success("Tarefa criada");
      setForm({ ...makeBlank(), team: form.team, teamId: form.teamId, deadline: form.deadline });
      setNewCheckItem("");
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  };

  const toggleResponsible = (id: string) => {
    setForm(prev => ({
      ...prev,
      responsibleIds: prev.responsibleIds.includes(id) ? prev.responsibleIds.filter(a => a !== id) : [...prev.responsibleIds, id],
    }));
  };

  const addCheckItem = () => {
    if (!newCheckItem.trim()) return;
    setForm(prev => ({ ...prev, checklist: [...prev.checklist, { text: newCheckItem.trim(), checked: false }] }));
    setNewCheckItem("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{task ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle></DialogHeader>
        <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Título *</label>
            <Input ref={titleRef} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Título da tarefa" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Descrição</label>
            <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Descrição..." rows={3}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSave(); } }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Prazo *</label>
              <Input type="date" value={form.deadline} onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Pontos</label>
              <Input
                type="number"
                min={0}
                value={form.points}
                onChange={e => setForm(p => ({ ...p, points: Math.max(0, parseInt(e.target.value) || 0) }))}
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Equipe</label>
            {lockedTeamId !== undefined && !task ? (
              <div className="text-xs px-2.5 py-1 rounded-full border border-primary bg-primary/10 text-primary inline-block">
                {lockedTeamId === null ? "Sem equipe" : (teams.find(t => t.id === lockedTeamId)?.name ?? "Equipe")}
              </div>
            ) : (
              <TeamSelector selectedId={form.teamId} onChange={(id) => setForm(p => ({ ...p, teamId: id }))} />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Prioridade</label>
              <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="high">Alta</option>
                <option value="medium">Média</option>
                <option value="low">Baixa</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="not-started">Não Começado</option>
                <option value="in-progress">Em Andamento</option>
                <option value="done">Pronto</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Responsáveis</label>
            <TeamPersonSelector
              selectedIds={form.responsibleIds}
              onToggle={toggleResponsible}
              restrictTeamId={lockedTeamId !== undefined && !task ? lockedTeamId : undefined}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Checklist</label>
            <div className="flex flex-col gap-1.5">
              {form.checklist.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Checkbox checked={item.checked} onCheckedChange={(checked) => {
                    const updated = [...form.checklist]; updated[i] = { ...item, checked: !!checked };
                    setForm(p => ({ ...p, checklist: updated }));
                  }} />
                  <span className={`text-sm flex-1 ${item.checked ? "line-through text-muted-foreground" : "text-foreground"}`}>{item.text}</span>
                  <button type="button" onClick={() => setForm(p => ({ ...p, checklist: p.checklist.filter((_, j) => j !== i) }))} className="text-muted-foreground hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input value={newCheckItem} onChange={e => setNewCheckItem(e.target.value)} placeholder="Novo item..." className="h-8 text-sm"
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCheckItem(); } }} />
                <Button type="button" variant="outline" size="sm" onClick={addCheckItem}><Plus className="h-3 w-3" /></Button>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit">{task ? "Salvar" : "Criar Tarefa"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
