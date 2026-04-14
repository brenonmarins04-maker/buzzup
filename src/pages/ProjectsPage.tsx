import { useData } from "@/contexts/DataContext";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import ProjectModal from "@/components/modals/ProjectModal";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import { toast } from "sonner";

const statusBadge: Record<string, { label: string; class: string }> = {
  active: { label: "Ativo", class: "bg-status-done/10 text-status-done" },
  completed: { label: "Concluído", class: "bg-muted text-muted-foreground" },
};

export default function ProjectsPage() {
  const { projects, deleteProject } = useData();
  const [modal, setModal] = useState<{ open: boolean; project?: any }>({ open: false });
  const [tab, setTab] = useState<"active" | "completed">("active");
  const [deleting, setDeleting] = useState<{ open: boolean; id: string; title: string }>({ open: false, id: "", title: "" });

  const filtered = projects.filter(p => p.status === tab);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Projetos</h1>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} projetos</p>
        </div>
        <button onClick={() => setModal({ open: true })} className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" /> Novo Projeto
        </button>
      </div>

      <div className="flex bg-muted rounded-md p-0.5 w-fit">
        <button onClick={() => setTab("active")} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${tab === "active" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>Ativos</button>
        <button onClick={() => setTab("completed")} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${tab === "completed" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>Concluídos</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((project) => {
          const st = statusBadge[project.status];
          return (
            <div key={project.id} className="bg-card border border-border rounded-lg p-5 hover:shadow-md transition-all cursor-pointer flex flex-col gap-4 relative group"
              onClick={() => setModal({ open: true, project })}>
              <button onClick={e => { e.stopPropagation(); setDeleting({ open: true, id: project.id, title: project.name }); }}
                className="absolute top-2 right-2 h-6 w-6 rounded-full bg-destructive/10 text-destructive flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20">
                <X className="h-3.5 w-3.5" />
              </button>
              <div className="flex items-start justify-between pr-6">
                <h2 className="text-base font-semibold text-foreground">{project.name}</h2>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${st?.class}`}>{st?.label}</span>
              </div>
              {project.description && <p className="text-xs text-muted-foreground line-clamp-2">{project.description}</p>}
              {project.members.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {project.members.map(m => (
                    <span key={m.id} className="text-[10px] bg-accent text-foreground px-2 py-0.5 rounded-full">{m.name}</span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground col-span-full text-center py-8">Nenhum projeto</p>}
      </div>

      <ProjectModal open={modal.open} onOpenChange={o => setModal({ open: o })} project={modal.project} />
      <DeleteConfirmDialog open={deleting.open} onOpenChange={o => setDeleting(p => ({ ...p, open: o }))}
        title={deleting.title} onConfirm={() => { deleteProject(deleting.id); toast.success("Projeto excluído"); }} />
    </div>
  );
}
