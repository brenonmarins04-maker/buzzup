import { useState, useEffect } from "react";
import { useData } from "@/contexts/DataContext";
import type { Task } from "@/lib/mock-data";
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
  task?: Task | null;
  defaultDate?: string;
};

export default function TaskModal({ open, onOpenChange, task, defaultDate }: Props) {
  const { teams, projects, addTask, updateTask } = useData();
  const allMembers = teams.flatMap(t => t.members);

  const [form, setForm] = useState({
    title: "",
    description: "",
    assignees: [] as string[],
    teamId: teams[0]?.id || "",
    projectId: projects[0]?.id || "",
    deadline: defaultDate || "",
    status: "not-started" as Task["status"],
    priority: "medium" as Task["priority"],
  });

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title,
        description: task.description,
        assignees: task.assignees,
        teamId: task.teamId,
        projectId: task.projectId,
        deadline: task.deadline,
        status: task.status,
        priority: task.priority,
      });
    } else {
      setForm({
        title: "",
        description: "",
        assignees: [],
        teamId: teams[0]?.id || "",
        projectId: projects[0]?.id || "",
        deadline: defaultDate || "",
        status: "not-started",
        priority: "medium",
      });
    }
  }, [task, defaultDate, open, teams, projects]);

  const handleSave = () => {
    if (!form.title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }
    if (task) {
      updateTask({ ...task, ...form });
      toast.success("Tarefa atualizada");
    } else {
      addTask(form);
      toast.success("Tarefa criada");
    }
    onOpenChange(false);
  };

  const toggleAssignee = (name: string) => {
    setForm(prev => ({
      ...prev,
      assignees: prev.assignees.includes(name)
        ? prev.assignees.filter(a => a !== name)
        : [...prev.assignees, name],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Título *</label>
            <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Título da tarefa" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Descrição</label>
            <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Descrição..." rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Equipe</label>
              <select value={form.teamId} onChange={e => setForm(p => ({ ...p, teamId: e.target.value }))} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Projeto</label>
              <select value={form.projectId} onChange={e => setForm(p => ({ ...p, projectId: e.target.value }))} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Prazo</label>
              <Input type="date" value={form.deadline} onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Prioridade</label>
              <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value as Task["priority"] }))} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="high">Alta</option>
                <option value="medium">Média</option>
                <option value="low">Baixa</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as Task["status"] }))} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="not-started">Não Começado</option>
                <option value="in-progress">Em Andamento</option>
                <option value="done">Pronto</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Responsáveis</label>
            <div className="flex flex-wrap gap-1.5">
              {allMembers.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleAssignee(m)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    form.assignees.includes(m) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{task ? "Salvar" : "Criar Tarefa"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
