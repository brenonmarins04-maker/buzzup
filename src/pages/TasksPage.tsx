import { useState } from "react";
import { tasks, teams, projects } from "@/lib/mock-data";
import { Plus, GripVertical } from "lucide-react";

const statusColumns = [
  { id: "not-started" as const, label: "Não Começado", dotClass: "bg-status-not-started" },
  { id: "in-progress" as const, label: "Em Andamento", dotClass: "bg-status-in-progress" },
  { id: "done" as const, label: "Pronto", dotClass: "bg-status-done" },
];

export default function TasksPage() {
  const [filterTeam, setFilterTeam] = useState("all");
  const [filterProject, setFilterProject] = useState("all");

  const filteredTasks = tasks.filter((t) => {
    if (filterTeam !== "all" && t.teamId !== filterTeam) return false;
    if (filterProject !== "all" && t.projectId !== filterProject) return false;
    return true;
  });

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Tarefas</h1>
          <p className="text-sm text-muted-foreground mt-1">{filteredTasks.length} tarefas</p>
        </div>
        <button className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" /> Nova Tarefa
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={filterTeam}
          onChange={(e) => setFilterTeam(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">Todas equipes</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">Todos projetos</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {statusColumns.map((col) => {
          const colTasks = filteredTasks.filter((t) => t.status === col.id);
          return (
            <div key={col.id} className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${col.dotClass}`} />
                  <h2 className="text-sm font-medium text-foreground">{col.label}</h2>
                </div>
                <span className="text-xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {colTasks.length}
                </span>
              </div>

              <div className="flex flex-col gap-2 min-h-[200px]">
                {colTasks.map((task) => {
                  const team = teams.find((t) => t.id === task.teamId);
                  const project = projects.find((p) => p.id === task.projectId);
                  return (
                    <div
                      key={task.id}
                      className="bg-card border border-border rounded-lg p-4 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground bg-muted px-2 py-0.5 rounded-sm">
                          {project?.name || "Sem projeto"}
                        </span>
                        <span
                          className={`h-2 w-2 rounded-full shrink-0 mt-1 ${
                            task.priority === "high"
                              ? "bg-priority-high"
                              : task.priority === "medium"
                              ? "bg-priority-medium"
                              : "bg-priority-low"
                          }`}
                        />
                      </div>
                      <p className="text-sm font-medium text-foreground leading-snug mb-3">
                        {task.title}
                      </p>
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                        {task.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {task.deadline}
                        </span>
                        <div className="flex -space-x-1.5">
                          {task.assignees.slice(0, 2).map((a, i) => (
                            <div
                              key={i}
                              className="h-5 w-5 rounded-full bg-accent border border-card flex items-center justify-center text-[9px] font-semibold text-foreground"
                              title={a}
                            >
                              {a.split(" ").map((n) => n[0]).join("")}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {colTasks.length === 0 && (
                  <div className="border-2 border-dashed border-border rounded-lg flex items-center justify-center py-8 text-sm text-muted-foreground">
                    Sem tarefas
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
