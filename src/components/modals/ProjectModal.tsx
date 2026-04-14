import { useState, useEffect } from "react";
import { useData } from "@/contexts/DataContext";
import type { Project } from "@/contexts/DataContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project | null;
};

export default function ProjectModal({ open, onOpenChange, project }: Props) {
  const { people, addProject, updateProject } = useData();
  const [form, setForm] = useState({
    name: "", description: "", color: "#888888", status: "active", memberIds: [] as string[],
  });

  useEffect(() => {
    if (project) {
      setForm({ name: project.name, description: project.description, color: project.color, status: project.status, memberIds: project.members.map(m => m.id) });
    } else {
      setForm({ name: "", description: "", color: "#888888", status: "active", memberIds: [] });
    }
  }, [project, open]);

  const toggleMember = (id: string) => {
    setForm(p => ({
      ...p,
      memberIds: p.memberIds.includes(id) ? p.memberIds.filter(m => m !== id) : [...p.memberIds, id],
    }));
  };

  const handleSave = () => {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    if (project) {
      updateProject({
        ...project, name: form.name, description: form.description,
        color: form.color, status: form.status,
        members: people.filter(p => form.memberIds.includes(p.id)),
      });
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
        <DialogHeader><DialogTitle>{project ? "Editar Projeto" : "Novo Projeto"}</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome *</label>
            <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Nome do projeto" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Descrição</label>
            <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Descrição do projeto..." rows={3} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="active">Ativo</option>
              <option value="completed">Concluído</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Participantes</label>
            {people.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma pessoa cadastrada.</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-40 overflow-y-auto border border-input rounded-md p-2">
                {people.map(person => (
                  <label key={person.id} className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox checked={form.memberIds.includes(person.id)} onCheckedChange={() => toggleMember(person.id)} />
                    {person.name}
                  </label>
                ))}
              </div>
            )}
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
