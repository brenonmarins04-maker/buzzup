import { useState } from "react";
import { useData } from "@/contexts/DataContext";
import type { Task } from "@/contexts/DataContext";
import { Plus, X } from "lucide-react";
import TaskModal from "@/components/modals/TaskModal";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import { toast } from "sonner";
import { getNowBrasilia } from "@/lib/utils";

const statusColumns = [
  { id: "not-started", label: "Não Começado", dotClass: "bg-status-not-started" },
  { id: "in-progress", label: "Em Andamento", dotClass: "bg-status-in-progress" },
];

function getDeadlineBorderClass(deadline: string, status: string) {
  if (status === "done") return "border-l-status-done";
  const today = getNowBrasilia();
  const d = new Date(deadline);
  const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return "border-l-destructive";
  if (diff <= 2) return "border-l-priority-high";
  if (diff <= 5) return "border-l-priority-medium";
  return "border-l-priority-low";
}

export default function TasksPage() {
  const { tasks, updateTask, deleteTask } = useData();
  const [modal, setModal] = useState<{ open: boolean; task?: Task | null }>({ open: false });
  const [dragTask, setDragTask] = useState<string | null>(null);
  const [tab, setTab] = useState<"active" | "done">("active");
  const [deleting, setDeleting] = useState<{ open: boolean; id: string; title: string }>({ open: false, id: "", title: "" });

  const filteredTasks = tasks.filter((t) => {
    if (tab === "active") return t.status !== "done";
    return t.status === "done";
  });

  const handleDrop = (status: string) => {
    if (!dragTask) return;
    const task = tasks.find(t => t.id === dragTask);
    if (task && task.status !== status) updateTask({ ...task, status });
    setDragTask(null);
  };

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Tarefas</h1>
          <p className="text-sm text-muted-foreground mt-1">{filteredTasks.length} tarefas</p>
        </div>
        <button onClick={() => setModal({ open: true })} className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" /> Nova Tarefa
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-muted rounded-md p-0.5">
          <button onClick={() => setTab("active")} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${tab === "active" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>Ativas</button>
          <button onClick={() => setTab("done")} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${tab === "done" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>Concluídas</button>
        </div>
      </div>

      {tab === "active" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {statusColumns.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.id);
            return (
              <div key={col.id} className="flex flex-col gap-3"
                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                onDrop={() => handleDrop(col.id)}>
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${col.dotClass}`} />
                    <h2 className="text-sm font-medium text-foreground">{col.label}</h2>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{colTasks.length}</span>
                </div>
                <div className="flex flex-col gap-2 min-h-[200px]">
                  {colTasks.map((task) => (
                    <div key={task.id} draggable onDragStart={() => setDragTask(task.id)} onDragEnd={() => setDragTask(null)}
                      onClick={() => setModal({ open: true, task })}
                      className={`bg-card border border-border border-l-4 ${getDeadlineBorderClass(task.deadline, task.status)} rounded-lg p-4 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing relative group ${dragTask === task.id ? "opacity-50" : ""}`}>
                      <button onClick={e => { e.stopPropagation(); setDeleting({ open: true, id: task.id, title: task.title }); }}
                        className="absolute top-2 right-2 h-5 w-5 rounded-full bg-destructive/10 text-destructive flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20">
                        <X className="h-3 w-3" />
                      </button>
                      <div className="flex items-start justify-between mb-2 pr-5">
                        <span className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground bg-muted px-2 py-0.5 rounded-sm">{task.team || "Sem equipe"}</span>
                        <span className={`h-2 w-2 rounded-full shrink-0 mt-1 ${task.priority === "high" ? "bg-priority-high" : task.priority === "medium" ? "bg-priority-medium" : "bg-priority-low"}`} />
                      </div>
                      <p className="text-sm font-medium text-foreground leading-snug mb-2">{task.title}</p>
                      {task.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{task.description}</p>}
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-medium ${getDeadlineBorderClass(task.deadline, task.status).replace("border-l-", "text-")}`}>{task.deadline}</span>
                        <div className="flex -space-x-1.5">
                          {task.responsible.slice(0, 2).map((a) => (
                            <div key={a.id} className="h-5 w-5 rounded-full bg-accent border border-card flex items-center justify-center text-[9px] font-semibold text-foreground" title={a.name}>
                              {a.name.split(" ").map(n => n[0]).join("")}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                  {colTasks.length === 0 && (
                    <div className="border-2 border-dashed border-border rounded-lg flex items-center justify-center py-8 text-sm text-muted-foreground">Sem tarefas</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredTasks.map((task) => (
            <div key={task.id} onClick={() => setModal({ open: true, task })}
              className="bg-card border border-border rounded-lg p-4 flex items-center justify-between cursor-pointer hover:shadow-sm transition-all relative group">
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-status-done" />
                <div>
                  <p className="text-sm font-medium text-foreground">{task.title}</p>
                  <p className="text-xs text-muted-foreground">{task.team || "Sem equipe"} • {task.deadline}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex -space-x-1.5">
                  {task.responsible.slice(0, 2).map((a) => (
                    <div key={a.id} className="h-5 w-5 rounded-full bg-accent border border-card flex items-center justify-center text-[9px] font-semibold text-foreground">{a.name.split(" ").map(n => n[0]).join("")}</div>
                  ))}
                </div>
                <button onClick={e => { e.stopPropagation(); setDeleting({ open: true, id: task.id, title: task.title }); }}
                  className="h-5 w-5 rounded-full bg-destructive/10 text-destructive flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20">
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
          {filteredTasks.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhuma tarefa concluída</p>}
        </div>
      )}

      <TaskModal open={modal.open} onOpenChange={o => setModal({ open: o })} task={modal.task} />
      <DeleteConfirmDialog open={deleting.open} onOpenChange={o => setDeleting(p => ({ ...p, open: o }))}
        title={deleting.title} onConfirm={() => { deleteTask(deleting.id); toast.success("Tarefa excluída"); }} />
    </div>
  );
}
