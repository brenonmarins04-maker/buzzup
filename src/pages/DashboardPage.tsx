import { useData } from "@/contexts/DataContext";
import {
  CheckCircle2,
  Clock,
  FileText,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  BarChart3,
  Megaphone,
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

const PIE_COLORS = [
  "hsl(330, 70%, 55%)",
  "hsl(210, 80%, 52%)",
  "hsl(170, 80%, 40%)",
  "hsl(40, 6%, 10%)",
  "hsl(280, 60%, 55%)",
];

function getDeadlineColor(deadline: string) {
  const today = new Date();
  const d = new Date(deadline);
  const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return "text-destructive";
  if (diff <= 2) return "text-priority-high";
  if (diff <= 5) return "text-priority-medium";
  return "text-priority-low";
}

export default function DashboardPage() {
  const { teams, tasks, posts, channels } = useData();

  const today = new Date().toISOString().split("T")[0];
  const todayDate = new Date();

  // Alerts
  const overdueTasks = tasks.filter(t => t.status !== "done" && t.deadline < today);
  const dueTodayTasks = tasks.filter(t => t.status !== "done" && t.deadline === today);
  const upcomingSoonTasks = tasks.filter(t => {
    if (t.status === "done") return false;
    const diff = Math.ceil((new Date(t.deadline).getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 && diff <= 3;
  });
  const todayPosts = posts.filter(p => p.date === today && p.status !== "published" && p.status !== "done");
  const overduePosts = posts.filter(p => p.date < today && p.status !== "published" && p.status !== "done");

  // Stats
  const activeTasks = tasks.filter(t => t.status !== "done");
  const completedTasks = tasks.filter(t => t.status === "done");
  const totalPosts = posts.length;
  const onTimePosts = posts.filter(p => p.status === "done" || p.status === "published").length;

  const postsByChannel = channels.map(ch => ({
    channel: ch.name,
    count: posts.filter(p => p.channel === ch.id).length,
  }));

  const productivityByTeam = teams.map(team => ({
    team: team.name.split(" ")[0],
    completed: tasks.filter(t => t.teamId === team.id && t.status === "done").length,
    total: tasks.filter(t => t.teamId === team.id).length,
  }));

  const hasAlerts = overdueTasks.length > 0 || dueTodayTasks.length > 0 || upcomingSoonTasks.length > 0 || todayPosts.length > 0 || overduePosts.length > 0;

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Resumo geral</p>
      </div>

      {/* Atenção Hoje */}
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

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-4 md:p-5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-wider">Concluídas</span>
            <CheckCircle2 className="h-4 w-4 text-status-done" />
          </div>
          <div className="flex items-end gap-2 mt-2">
            <span className="text-2xl md:text-3xl font-bold text-foreground">{completedTasks.length}/{tasks.length}</span>
            <span className="text-sm text-muted-foreground mb-0.5">({tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0}%)</span>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 md:p-5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-wider">Posts</span>
            <FileText className="h-4 w-4 text-channel-instagram" />
          </div>
          <span className="text-2xl md:text-3xl font-bold text-foreground mt-2 block">{totalPosts}</span>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 md:p-5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-wider">No Prazo</span>
            <Clock className="h-4 w-4 text-status-in-progress" />
          </div>
          <span className="text-2xl md:text-3xl font-bold text-foreground mt-2 block">{onTimePosts}</span>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 md:p-5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-wider">Prazos</span>
            <AlertTriangle className="h-4 w-4 text-priority-high" />
          </div>
          <span className="text-2xl md:text-3xl font-bold text-foreground mt-2 block">{activeTasks.length}</span>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Produtividade por Equipe</h2>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productivityByTeam}>
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
