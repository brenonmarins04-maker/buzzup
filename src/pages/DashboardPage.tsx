import { useData } from "@/contexts/DataContext";
import {
  TrendingUp, BarChart3, Users, UsersRound, Trophy, Medal,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { getNowBrasilia, getTodayBrasilia } from "@/lib/utils";

const PIE_COLORS = ["hsl(330, 70%, 55%)", "hsl(210, 80%, 52%)", "hsl(170, 80%, 40%)", "hsl(40, 6%, 10%)", "hsl(280, 60%, 55%)"];

export default function DashboardPage() {
  const { people, tasks, posts, channels, projects, teams, loading } = useData();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const postsByChannel = channels.map(ch => ({ channel: ch.name, count: posts.filter(p => p.channel === ch.id).length }));

  // Ranking gamificação
  const doneTasksAll = tasks.filter(t => t.status === "done");
  const pointsByPerson: Record<string, number> = {};
  doneTasksAll.forEach(t => {
    t.responsible.forEach(r => { pointsByPerson[r.id] = (pointsByPerson[r.id] || 0) + (t.points || 0); });
  });
  const ranking = people
    .map(p => ({
      id: p.id,
      label: (p.nickname && p.nickname.trim()) ? p.nickname.trim() : p.name,
      points: pointsByPerson[p.id] || 0,
    }))
    .filter(r => r.points > 0)
    .sort((a, b) => b.points - a.points);

  // People in projects stats
  const activeProjects = projects.filter(p => p.status === "active");
  const memberProjectCount: Record<string, number> = {};
  activeProjects.forEach(p => p.members.forEach(m => { memberProjectCount[m.id] = (memberProjectCount[m.id] || 0) + 1; }));
  const membersNotInProjects = people.filter(p => !memberProjectCount[p.id]);
  const membersInMultiple = people.filter(p => (memberProjectCount[p.id] || 0) > 1).map(p => ({ name: p.name, count: memberProjectCount[p.id] }));

  const membersIn0 = people.filter(p => !memberProjectCount[p.id]).length;
  const membersIn1 = people.filter(p => memberProjectCount[p.id] === 1).length;
  const membersIn2Plus = people.filter(p => (memberProjectCount[p.id] || 0) >= 2).length;
  const allocationPieData = [
    { name: "Sem projeto", value: membersIn0, color: "#ef4444" },
    { name: "1 projeto", value: membersIn1, color: "#22c55e" },
    { name: "2+ projetos", value: membersIn2Plus, color: "#ec4899" },
  ].filter(d => d.value > 0);

  // Tasks completed by person
  const doneTasks = tasks.filter(t => t.status === "done");
  const tasksByPerson = people.map(person => ({
    name: person.name.split(" ")[0],
    fullName: person.name,
    completed: doneTasks.filter(t => t.responsible.some(r => r.id === person.id)).length,
  })).sort((a, b) => b.completed - a.completed).filter(d => d.completed > 0);

  // Tasks completed by team
  const tasksByTeam = teams.map(team => ({
    name: team.name,
    completed: doneTasks.filter(t => t.teamId === team.id).length,
  })).sort((a, b) => b.completed - a.completed).filter(d => d.completed > 0);

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Início</h1>
        <p className="text-sm text-muted-foreground mt-1">Resumo geral</p>
      </div>

      {/* Ranking de Gamificação */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" /> Ranking
        </h2>
        {ranking.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum ponto ainda. Conclua tarefas com pontos atribuídos para entrar no ranking.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {ranking.map((r, i) => {
              const medalColor = i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-700" : "text-muted-foreground";
              return (
                <li key={r.id} className="flex items-center gap-3 p-2.5 rounded-md bg-muted/40">
                  <div className="flex items-center justify-center w-7 h-7 shrink-0">
                    {i < 3 ? <Medal className={`h-5 w-5 ${medalColor}`} /> : <span className="text-xs font-bold text-muted-foreground">{i + 1}</span>}
                  </div>
                  <span className="flex-1 text-sm font-medium text-foreground truncate">{r.label}</span>
                  <span className="text-sm font-bold text-primary">{r.points} pts</span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Pessoas em Projetos */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" /> Pessoas em Projetos
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            {membersNotInProjects.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Sem projeto ({membersNotInProjects.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {membersNotInProjects.map(m => (
                    <span key={m.id} className="text-xs bg-muted text-foreground px-2 py-0.5 rounded-full">{m.name}</span>
                  ))}
                </div>
              </div>
            )}
            {membersInMultiple.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Em mais de 1 projeto</p>
                <div className="flex flex-wrap gap-1.5">
                  {membersInMultiple.map(({ name, count }) => (
                    <span key={name} className="text-xs bg-accent text-foreground px-2 py-0.5 rounded-full">{name} ({count})</span>
                  ))}
                </div>
              </div>
            )}
            {membersNotInProjects.length === 0 && membersInMultiple.length === 0 && (
              <p className="text-xs text-muted-foreground">Todos os membros estão em exatamente 1 projeto.</p>
            )}
          </div>
          {allocationPieData.length > 0 && (
            <div className="h-48 flex items-center">
              <ResponsiveContainer width="50%" height="100%">
                <PieChart>
                  <Pie data={allocationPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
                    {allocationPieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(40, 6%, 90%)", fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 flex flex-col gap-2">
                {allocationPieData.map(item => (
                  <div key={item.name} className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-muted-foreground">{item.name}</span>
                    <span className="ml-auto font-semibold text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tarefas concluídas por pessoa */}
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Tarefas Concluídas por Pessoa</h2>
          </div>
          <div className="h-48">
            {tasksByPerson.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tasksByPerson} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 6%, 90%)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(40, 3%, 55%)" />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} stroke="hsl(40, 3%, 55%)" width={80} />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid hsl(40, 6%, 90%)", fontSize: "12px" }}
                    formatter={(value: number, _name: string, props: any) => [value, props.payload.fullName]}
                  />
                  <Bar dataKey="completed" fill="hsl(40, 6%, 10%)" radius={[0, 4, 4, 0]} name="Concluídas" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                Nenhuma tarefa concluída ainda
              </div>
            )}
          </div>
        </div>

        {/* Tarefas concluídas por equipe */}
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <UsersRound className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Tarefas Concluídas por Equipe</h2>
          </div>
          <div className="h-48">
            {tasksByTeam.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tasksByTeam} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 6%, 90%)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(40, 3%, 55%)" />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} stroke="hsl(40, 3%, 55%)" width={100} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(40, 6%, 90%)", fontSize: "12px" }} />
                  <Bar dataKey="completed" fill="hsl(210, 80%, 52%)" radius={[0, 4, 4, 0]} name="Concluídas" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                {teams.length === 0 ? "Nenhuma equipe criada ainda" : "Nenhuma tarefa concluída por equipe"}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Posts por canal */}
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Posts por Canal</h2>
        </div>
        <div className="h-48 flex items-center">
          <ResponsiveContainer width="50%" height="100%">
            <PieChart>
              <Pie data={postsByChannel} dataKey="count" nameKey="channel" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
                {postsByChannel.map((_, index) => <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(40, 6%, 90%)", fontSize: "12px" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 flex flex-col gap-2">
            {postsByChannel.map((item, i) => (
              <div key={item.channel} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                <span className="text-muted-foreground">{item.channel}</span>
                <span className="ml-auto font-semibold text-foreground">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
