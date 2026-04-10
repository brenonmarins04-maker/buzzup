import { dashboardStats, teams, tasks, posts } from "@/lib/mock-data";
import {
  CheckCircle2,
  Clock,
  FileText,
  AlertTriangle,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const statCards = [
  {
    label: "Tarefas Concluídas",
    value: `${dashboardStats.completedTasks}/${dashboardStats.totalTasks}`,
    percent: Math.round((dashboardStats.completedTasks / dashboardStats.totalTasks) * 100),
    icon: CheckCircle2,
    color: "text-status-done",
  },
  {
    label: "Posts Planejados",
    value: dashboardStats.totalPosts.toString(),
    percent: null,
    icon: FileText,
    color: "text-channel-instagram",
  },
  {
    label: "Posts no Prazo",
    value: dashboardStats.onTimePosts.toString(),
    percent: Math.round((dashboardStats.onTimePosts / dashboardStats.totalPosts) * 100),
    icon: Clock,
    color: "text-status-in-progress",
  },
  {
    label: "Próximos Prazos",
    value: dashboardStats.upcomingDeadlines.length.toString(),
    percent: null,
    icon: AlertTriangle,
    color: "text-priority-high",
  },
];

const PIE_COLORS = [
  "hsl(330, 70%, 55%)",
  "hsl(210, 80%, 52%)",
  "hsl(170, 80%, 40%)",
  "hsl(40, 6%, 10%)",
];

export default function DashboardPage() {
  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Resumo do mês de Abril 2026</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="bg-card border border-border rounded-lg p-5 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {stat.label}
              </span>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-foreground">{stat.value}</span>
              {stat.percent !== null && (
                <span className="text-sm font-medium text-muted-foreground mb-1">
                  ({stat.percent}%)
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Productivity by Team */}
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Produtividade por Equipe</h2>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboardStats.productivityByTeam}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 6%, 90%)" />
                <XAxis dataKey="team" tick={{ fontSize: 11 }} stroke="hsl(40, 3%, 55%)" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(40, 3%, 55%)" />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid hsl(40, 6%, 90%)",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="total" fill="hsl(40, 6%, 90%)" radius={[4, 4, 0, 0]} name="Total" />
                <Bar dataKey="completed" fill="hsl(40, 6%, 10%)" radius={[4, 4, 0, 0]} name="Concluídas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Posts by Channel */}
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Posts por Canal</h2>
          </div>
          <div className="h-48 flex items-center">
            <ResponsiveContainer width="50%" height="100%">
              <PieChart>
                <Pie
                  data={dashboardStats.postsByChannel}
                  dataKey="count"
                  nameKey="channel"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  innerRadius={40}
                >
                  {dashboardStats.postsByChannel.map((_, index) => (
                    <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(40, 6%, 90%)", fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 flex flex-col gap-2">
              {dashboardStats.postsByChannel.map((item, i) => (
                <div key={item.channel} className="flex items-center gap-2 text-sm">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: PIE_COLORS[i] }}
                  />
                  <span className="text-muted-foreground">{item.channel}</span>
                  <span className="ml-auto font-semibold text-foreground">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Deadlines + Teams */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Deadlines */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">⚠️ Próximos Prazos</h2>
          <div className="flex flex-col gap-3">
            {dashboardStats.upcomingDeadlines.map((d, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <span
                    className={`h-2 w-2 rounded-full shrink-0 ${
                      d.priority === "high"
                        ? "bg-priority-high"
                        : d.priority === "medium"
                        ? "bg-priority-medium"
                        : "bg-priority-low"
                    }`}
                  />
                  <span className="text-sm font-medium text-foreground">{d.title}</span>
                </div>
                <span className="text-xs text-muted-foreground">{d.date}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Teams Overview */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">👥 Equipes</h2>
          <div className="flex flex-col gap-3">
            {teams.map((team) => (
              <div key={team.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full shrink-0 bg-${team.color}`} />
                  <div>
                    <span className="text-sm font-medium text-foreground">{team.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">Líder: {team.leader}</span>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{team.members.length} membros</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
