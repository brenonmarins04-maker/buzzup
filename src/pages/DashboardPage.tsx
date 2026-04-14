import { useData } from "@/contexts/DataContext";
import {
  Clock, AlertTriangle, AlertCircle, TrendingUp, BarChart3, Megaphone, Users,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

const PIE_COLORS = ["hsl(330, 70%, 55%)", "hsl(210, 80%, 52%)", "hsl(170, 80%, 40%)", "hsl(40, 6%, 10%)", "hsl(280, 60%, 55%)"];

export default function DashboardPage() {
  const { teams, tasks, posts, channels, projects, allMembers, loading } = useData();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const today = new Date().toISOString().split("T")[0];
  const todayDate = new Date();

  const overdueTasks = tasks.filter(t => t.status !== "done" && t.deadline < today);
  const dueTodayTasks = tasks.filter(t => t.status !== "done" && t.deadline === today);
  const upcomingSoonTasks = tasks.filter(t => {
    if (t.status === "done") return false;
    const diff = Math.ceil((new Date(t.deadline).getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 && diff <= 3;
  });
  const todayPosts = posts.filter(p => p.date === today && p.status !== "published" && p.status !== "done");
  const overduePosts = posts.filter(p => p.date < today && p.status !== "published" && p.status !== "done");

  const postsByChannel = channels.map(ch => ({ channel: ch.name, count: posts.filter(p => p.channel === ch.id).length }));
  const completedByTeam = teams.map(team => ({
    team: team.name.split(" ")[0],
    completed: tasks.filter(t => t.team === team.id && t.status === "done").length,
    total: tasks.filter(t => t.team === team.id).length,
  }));

  // People in projects stats
  const uniqueMembers = [...new Set(allMembers)];
  const activeProjects = projects.filter(p => p.status === "active");
  const membersInProjects = new Set(activeProjects.flatMap(p => p.members || []));
  const membersNotInProjects = uniqueMembers.filter(m => !membersInProjects.has(m));
  const memberProjectCount: Record<string, number> = {};
  activeProjects.forEach(p => (p.members || []).forEach(m => { memberProjectCount[m] = (memberProjectCount[m] || 0) + 1; }));
  const membersInMultiple = Object.entries(memberProjectCount).filter(([, c]) => c > 1);

  // Pie chart data for project allocation
  const membersIn0 = uniqueMembers.filter(m => !memberProjectCount[m]).length;
  const membersIn1 = uniqueMembers.filter(m => memberProjectCount[m] === 1).length;
  const membersIn2Plus = uniqueMembers.filter(m => (memberProjectCount[m] || 0) >= 2).length;
  const allocationPieData = [
    { name: "Sem projeto", value: membersIn0, color: "#ef4444" },
    { name: "1 projeto", value: membersIn1, color: "#22c55e" },
    { name: "2+ projetos", value: membersIn2Plus, color: "#ec4899" },
  ].filter(d => d.value > 0);

  // Tasks completed by person
  const doneTasks = tasks.filter(t => t.status === "done");
  const tasksByPerson = uniqueMembers.map(member => ({
    name: member.split(" ")[0],
    fullName: member,
    completed: doneTasks.filter(t => (t.responsible || []).includes(member)).length,
  })).sort((a, b) => b.completed - a.completed).filter(d => d.completed > 0);

  const hasAlerts = overdueTasks.length > 0 || dueTodayTasks.length > 0 || upcomingSoonTasks.length > 0 || todayPosts.length > 0 || overduePosts.length > 0;

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Resumo geral</p>
      </div>

      {hasAlerts && (
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-priority-high" /> Atenção Hoje
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {overdueTasks.length > 0 && (
              <div className="flex items-start gap-3 p-3 rounded-md bg-destructive/5 border border-destructive/20">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-destructive">Tarefas atrasadas</p>
                  {overdueTasks.map(t => <p key={t.id} className="text-xs text-muted-foreground">{t.title}</p>)}
                </div>
              </div>
            )}
            {dueTodayTasks.length > 0 && (
              <div className="flex items-start gap-3 p-3 rounded-md bg-destructive/5 border border-destructive/20">
                <Clock className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-destructive">Vence hoje</p>
                  {dueTodayTasks.map(t => <p key={t.id} className="text-xs text-muted-foreground">{t.title}</p>)}
                </div>
              </div>
            )}
            {upcomingSoonTasks.length > 0 && (
              <div className="flex items-start gap-3 p-3 rounded-md bg-status-in-progress/5 border border-status-in-progress/20">
                <AlertTriangle className="h-4 w-4 text-status-in-progress shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-status-in-progress">Prazos próximos</p>
                  {upcomingSoonTasks.map(t => <p key={t.id} className="text-xs text-muted-foreground">{t.title} — {t.deadline}</p>)}
                </div>
              </div>
            )}
            {todayPosts.length > 0 && (
              <div className="flex items-start gap-3 p-3 rounded-md bg-status-published/5 border border-status-published/20">
                <Megaphone className="h-4 w-4 text-status-published shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-status-published">Publicações do dia</p>
                  {todayPosts.map(p => <p key={p.id} className="text-xs text-muted-foreground">{p.title}</p>)}
                </div>
              </div>
            )}
            {overduePosts.length > 0 && (
              <div className="flex items-start gap-3 p-3 rounded-md bg-destructive/5 border border-destructive/20">
                <Megaphone className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-destructive">Publicações atrasadas</p>
                  {overduePosts.map(p => <p key={p.id} className="text-xs text-muted-foreground">{p.title}</p>)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pessoas em Projetos — lista + pizza */}
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
                    <span key={m} className="text-xs bg-muted text-foreground px-2 py-0.5 rounded-full">{m}</span>
                  ))}
                </div>
              </div>
            )}
            {membersInMultiple.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Em mais de 1 projeto</p>
                <div className="flex flex-wrap gap-1.5">
                  {membersInMultiple.map(([name, count]) => (
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
        {/* Tarefas por equipe */}
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Tarefas Concluídas por Equipe</h2>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={completedByTeam}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 6%, 90%)" />
                <XAxis dataKey="team" tick={{ fontSize: 11 }} stroke="hsl(40, 3%, 55%)" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(40, 3%, 55%)" />
                <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(40, 6%, 90%)", fontSize: "12px" }} />
                <Bar dataKey="total" fill="hsl(40, 6%, 90%)" radius={[4, 4, 0, 0]} name="Total" />
                <Bar dataKey="completed" fill="hsl(40, 6%, 10%)" radius={[4, 4, 0, 0]} name="Concluídas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

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
    </div>
  );
}
