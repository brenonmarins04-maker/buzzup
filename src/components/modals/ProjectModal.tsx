import { useState, useEffect } from "react";
import { useData } from "@/contexts/DataContext";
import type { Project } from "@/lib/mock-data";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project | null;
};

export default function ProjectModal({ open, onOpenChange, project }: Props) {
  const { teams, addProject, updateProject } = useData();
  const [form, setForm] = useState({
    name: "",
    teamId: teams[0]?.id || "",
    status: "active" as Project["status"],
  });

  useEffect(() => {
    if (project) {
      setForm({ name: project.name, teamId: project.teamId, status: project.status });
    } else {
      setForm({ name: "", teamId: teams[0]?.id || "", status: "active" });
    }
  }, [project, open, teams]);

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{project ? "Editar Projeto" : "Novo Projeto"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome *</label>
            <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Nome do projeto" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Equipe</label>
            <select value={form.teamId} onChange={e => setForm(p => ({ ...p, teamId: e.target.value }))} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as Project["status"] }))} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="active">Ativo</option>
              <option value="paused">Pausado</option>
              <option value="completed">Concluído</option>
            </select>
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
