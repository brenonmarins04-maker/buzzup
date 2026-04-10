import { projects, teams, tasks, posts } from "@/lib/mock-data";
import { Plus } from "lucide-react";

const statusBadge: Record<string, { label: string; class: string }> = {
  active: { label: "Ativo", class: "bg-status-done/10 text-status-done" },
  completed: { label: "Concluído", class: "bg-muted text-muted-foreground" },
  paused: { label: "Pausado", class: "bg-status-in-progress/10 text-status-in-progress" },
};

export default function ProjectsPage() {
  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Projetos</h1>
          <p className="text-sm text-muted-foreground mt-1">{projects.length} projetos ativos</p>
        </div>
        <button className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" /> Novo Projeto
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project) => {
          const team = teams.find((t) => t.id === project.teamId);
          const projectTasks = tasks.filter((t) => t.projectId === project.id);
          const projectPosts = posts.filter((p) => p.projectId === project.id);
          const completedTasks = projectTasks.filter((t) => t.status === "done").length;
          const st = statusBadge[project.status];

          return (
            <div
              key={project.id}
              className="bg-card border border-border rounded-lg p-5 hover:shadow-md transition-all cursor-pointer flex flex-col gap-4"
            >
              <div className="flex items-start justify-between">
                <h2 className="text-base font-semibold text-foreground">{project.name}</h2>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${st.class}`}>
                  {st.label}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full bg-${team?.color}`} />
                <span className="text-xs text-muted-foreground">{team?.name}</span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-md p-3 text-center">
                  <div className="text-xl font-bold text-foreground">{projectTasks.length}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Tarefas</div>
                </div>
                <div className="bg-muted/50 rounded-md p-3 text-center">
                  <div className="text-xl font-bold text-foreground">{projectPosts.length}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Posts</div>
                </div>
              </div>

              {/* Progress */}
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Progresso das tarefas</span>
                  <span>{projectTasks.length > 0 ? Math.round((completedTasks / projectTasks.length) * 100) : 0}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-foreground rounded-full transition-all"
                    style={{
                      width: `${projectTasks.length > 0 ? (completedTasks / projectTasks.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
