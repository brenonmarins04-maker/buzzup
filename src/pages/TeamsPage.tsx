import { teams, tasks } from "@/lib/mock-data";

export default function TeamsPage() {
  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Equipes</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie as equipes e seus membros</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {teams.map((team) => {
          const teamTasks = tasks.filter((t) => t.teamId === team.id);
          const completed = teamTasks.filter((t) => t.status === "done").length;

          return (
            <div
              key={team.id}
              className="bg-card border border-border rounded-lg p-6 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className={`h-3 w-3 rounded-full bg-${team.color}`} />
                  <h2 className="text-lg font-semibold text-foreground">{team.name}</h2>
                </div>
                <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded">
                  {teamTasks.length} tarefas
                </span>
              </div>

              <div className="mb-4">
                <span className="text-xs text-muted-foreground">Líder:</span>
                <span className="text-sm font-medium text-foreground ml-1">{team.leader}</span>
              </div>

              {/* Progress */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Progresso</span>
                  <span>{teamTasks.length > 0 ? Math.round((completed / teamTasks.length) * 100) : 0}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-foreground rounded-full transition-all"
                    style={{
                      width: `${teamTasks.length > 0 ? (completed / teamTasks.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Members */}
              <div>
                <span className="text-xs text-muted-foreground mb-2 block">Membros</span>
                <div className="flex flex-wrap gap-2">
                  {team.members.map((member) => (
                    <div
                      key={member}
                      className="flex items-center gap-2 bg-muted/50 px-2.5 py-1.5 rounded-md"
                    >
                      <div className="h-5 w-5 rounded-full bg-accent flex items-center justify-center text-[9px] font-semibold text-foreground">
                        {member.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <span className="text-xs font-medium text-foreground">{member}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
