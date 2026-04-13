import { useState, useEffect } from "react";
import { useData } from "@/contexts/DataContext";
import type { Project } from "@/contexts/DataContext";
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
  project?: Project | null;
};

export default function ProjectModal({ open, onOpenChange, project }: Props) {
  const { teams, addProject, updateProject } = useData();
  const [form, setForm] = useState({
    name: "", description: "", team: "", color: "#888888", status: "active",
  });

  useEffect(() => {
    if (project) {
      setForm({ name: project.name, description: project.description, team: project.team, color: project.color, status: project.status });
    } else {
      setForm({ name: "", description: "", team: "", color: "#888888", status: "active" });
    }
  }, [project, open]);

  const handleSave = () => {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    if (project) {
      updateProject({ ...project, ...form });
      toast.success("Projeto atualizado");
    } else {
      addProject(form);
      toast.success("Projeto criado");
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{project ? "Editar Projeto" : "Novo Projeto"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome *</label>
            <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Nome do projeto" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Descrição</label>
            <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Descrição do projeto..." rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Equipe</label>
              <select value={form.team} onChange={e => setForm(p => ({ ...p, team: e.target.value }))} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Sem equipe</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="active">Ativo</option>
                <option value="completed">Concluído</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{project ? "Salvar" : "Criar Projeto"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
