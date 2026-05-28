import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Trophy, Medal, FolderKanban, CalendarDays, ListChecks, Megaphone,
  CheckCircle2, FolderPlus, CalendarPlus, TrendingUp, TrendingDown, Minus,
  Sparkles, Users,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { getNowBrasilia } from "@/lib/utils";
import { format, endOfWeek, isSameDay, differenceInHours, differenceInDays, subDays, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AREAS } from "@/lib/areas";

function timeAgo(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const h = differenceInHours(now, d);
  if (h < 1) return "agora há pouco";
  if (h < 24) return `Há ${h} hora${h > 1 ? "s" : ""}`;
  const days = differenceInDays(now, d);
  if (days < 7) return `Há ${days} dia${days > 1 ? "s" : ""}`;
  return format(d, "dd/MM");
}

function pctDelta(curr: number, prev: number) {
  if (prev === 0 && curr === 0) return { value: 0, sign: "flat" as const };
  if (prev === 0) return { value: 100, sign: "up" as const };
  const diff = ((curr - prev) / prev) * 100;
  const rounded = Math.round(diff);
  return { value: Math.abs(rounded), sign: rounded > 0 ? "up" as const : rounded < 0 ? "down" as const : "flat" as const };
}

type KpiProps = {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  delta: { value: number; sign: "up" | "down" | "flat" };
  spark: { v: number }[];
};
function KpiCard({ title, value, icon, color, delta, spark }: KpiProps) {
  const TrendIcon = delta.sign === "up" ? TrendingUp : delta.sign === "down" ? TrendingDown : Minus;
  const trendColor = delta.sign === "up" ? "text-emerald-600" : delta.sign === "down" ? "text-red-600" : "text-muted-foreground";
  const gradId = `g-${title.replace(/\s+/g, "")}`;
  return (
    <div className="relative overflow-hidden bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div
          className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${color}1F`, color }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground truncate">{title}</p>
          <p className="text-2xl font-bold text-foreground leading-tight">{value}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 mt-2">
        <TrendIcon className={`h-3.5 w-3.5 ${trendColor}`} />
        <span className={`text-[11px] font-semibold ${trendColor}`}>
          {delta.sign === "flat" ? "estável" : `${delta.sign === "up" ? "+" : "-"}${delta.value}%`}
        </span>
        <span className="text-[11px] text-muted-foreground">vs. semana anterior</span>
      </div>
      <div className="absolute right-0 bottom-0 w-24 h-12 opacity-70 pointer-events-none">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={spark}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#${gradId})`} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { people, tasks, projects, events, posts, broadcasts, gamificationAwards, loading } = useData();
  const { displayName, user } = useAuth();
  const today = getNowBrasilia();
  const weekStart = startOfWeek(today, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 0 });
  const sevenDaysAgo = subDays(today, 7);
  const fourteenDaysAgo = subDays(today, 14);
  const prevWeekStart = subDays(weekStart, 7);
  const prevWeekEnd = subDays(weekEnd, 7);

  const todayStr = format(today, "yyyy-MM-dd");
  const weekEndStr = format(weekEnd, "yyyy-MM-dd");
  const prevWeekStartStr = format(prevWeekStart, "yyyy-MM-dd");
  const prevWeekEndStr = format(prevWeekEnd, "yyyy-MM-dd");
  const sevenAgoStr = format(sevenDaysAgo, "yyyy-MM-dd");

  // KPIs current
  const tasksInProgress = tasks.filter(t => t.status === "in-progress" || t.status === "not-started").length;
  const projectsActive = projects.filter(p => p.status === "active").length;
  const eventsThisWeek = events.filter(e => e.date && e.date >= todayStr && e.date <= weekEndStr).length;
  const postsScheduled = posts.filter(p => p.status === "scheduled" || (p.date && p.date >= todayStr)).length;

  // KPIs 7 days ago (snapshot)
  const tasksInProgress7 = tasks.filter(t => new Date((t as any).created_at ?? 0).getTime() <= sevenDaysAgo.getTime() && t.status !== "done").length;
  const projectsActive7 = projects.filter(p => p.status === "active").length; // no historical state; approximate
  const eventsPrevWeek = events.filter(e => e.date && e.date >= prevWeekStartStr && e.date <= prevWeekEndStr).length;
  const postsScheduled7 = posts.filter(p => p.date && p.date >= sevenAgoStr && p.date < todayStr).length;

  // Sparkline data
  const spark = (curr: number, prev: number) => {
    const arr: { v: number }[] = [];
    const steps = 7;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      arr.push({ v: prev + (curr - prev) * t + (Math.sin(i) * Math.max(curr, prev, 1)) * 0.05 });
    }
    return arr;
  };

  // Ranking — soma TODOS os pontos da gamificação (demandas concluídas + ações manuais)
  const pointsByPerson: Record<string, number> = {};
  gamificationAwards.forEach(a => {
    pointsByPerson[a.personId] = (pointsByPerson[a.personId] || 0) + (a.points || 0);
  });
  const ranking = people
    .map(p => ({
      id: p.id,
      label: (p.nickname && p.nickname.trim()) ? p.nickname.trim() : p.name,
      points: pointsByPerson[p.id] || 0,
    }))
    .filter(r => r.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 8);

  // Active projects with progress
  const activeProjects = projects.filter(p => p.status === "active").map(p => {
    const projTasks = tasks.filter(t => t.responsible.some(r => p.members.some(m => m.id === r.id)));
    const total = projTasks.length;
    const done = projTasks.filter(t => t.status === "done").length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    return { ...p, total, done, pct };
  });

  // Tasks per person (top)
  const tasksPerPerson = people.map(p => {
    const ps = tasks.filter(t => t.responsible.some(r => r.id === p.id));
    const total = ps.length;
    const done = ps.filter(t => t.status === "done").length;
    return { id: p.id, name: p.name, total, done, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
  }).filter(p => p.total > 0).sort((a, b) => b.total - a.total).slice(0, 6);

  // Events this week
  const weekEvents = events
    .filter(e => e.date && e.date >= todayStr && e.date <= weekEndStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  // Activity feed
  const activity = useMemo(() => {
    const items: { id: string; type: string; label: string; ts: string; icon: React.ReactNode; color: string }[] = [];
    tasks.filter(t => t.status === "done").forEach(t => {
      const r = t.responsible[0]?.name ?? "Alguém";
      items.push({ id: `t-${t.id}`, type: "task", label: `${r} concluiu a demanda "${t.title}"`, ts: (t as any).created_at ?? new Date().toISOString(), icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: "#10B981" });
    });
    projects.forEach(p => {
      items.push({ id: `p-${p.id}`, type: "project", label: `Novo projeto "${p.name}" criado`, ts: (p as any).created_at ?? new Date().toISOString(), icon: <FolderPlus className="h-3.5 w-3.5" />, color: "#2563EB" });
    });
    events.forEach(e => {
      items.push({ id: `e-${e.id}`, type: "event", label: `Evento "${e.title}" agendado`, ts: (e as any).created_at ?? new Date().toISOString(), icon: <CalendarPlus className="h-3.5 w-3.5" />, color: "#F97316" });
    });
    broadcasts.forEach(b => {
      items.push({ id: `b-${b.id}`, type: "broadcast", label: `Comunicado publicado: "${b.message.slice(0, 60)}${b.message.length > 60 ? "…" : ""}"`, ts: b.createdAt, icon: <Megaphone className="h-3.5 w-3.5" />, color: "#8B5CF6" });
    });
    return items
      .filter(i => i.ts)
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
      .slice(0, 10);
  }, [tasks, projects, events, broadcasts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const fullName =
    (displayName && displayName.trim()) ||
    (user?.email ? user.email.split("@")[0] : "") ||
    "Usuário";
  const firstName = fullName.split(" ")[0];

  return (
    <div className="animate-fade-in space-y-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-accent to-secondary/40 p-6 md:p-8">
        <div className="flex flex-col md:flex-row items-center gap-6">
          {/* Illustration */}
          <div className="relative w-full md:w-64 h-32 md:h-36 shrink-0 rounded-xl bg-card/70 border border-border/70 backdrop-blur-sm overflow-hidden flex items-center justify-center">
            <svg viewBox="0 0 240 120" className="w-full h-full">
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <path d="M0,90 C40,80 60,60 90,55 C120,50 140,70 170,45 C195,25 215,20 240,15 L240,120 L0,120 Z" fill="url(#trendFill)" />
              <path d="M0,90 C40,80 60,60 90,55 C120,50 140,70 170,45 C195,25 215,20 240,15" stroke="#10B981" strokeWidth="2.5" fill="none" />
              <circle cx="195" cy="35" r="18" fill="#10B981" />
              <path d="M188,35 L193,40 L203,30" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight flex items-center justify-center md:justify-start gap-2">
              Olá, {firstName}! <span className="inline-block">👋</span>
            </h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1.5 max-w-md">
              Aqui está o resumo do que está acontecendo no workspace.
            </p>
          </div>
        </div>
      </div>

      {/* 3 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Active projects */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-[#2563EB]" /> Projetos ativos
            </h2>
            <Link to="/projetos" className="text-xs text-primary hover:underline">Ver todos</Link>
          </div>
          {activeProjects.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum projeto ativo.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {activeProjects.slice(0, 6).map(p => (
                <li key={p.id}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="flex-1 text-xs font-medium text-foreground truncate">{p.name}</span>
                    <span className="text-xs font-bold text-muted-foreground">{p.pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${p.pct}%`, backgroundColor: p.color }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Tasks per person */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-[#F97316]" /> Demandas por pessoa
            </h2>
            <Link to="/people" className="text-xs text-primary hover:underline">Ver todas</Link>
          </div>
          {tasksPerPerson.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem demandas atribuídas.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {tasksPerPerson.map(p => (
                <li key={p.id} className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[11px] font-bold shrink-0">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-foreground truncate">{p.name}</span>
                      <span className="text-[11px] text-muted-foreground shrink-0">{p.done}/{p.total}</span>
                    </div>
                    <div className="h-1.5 mt-1 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${p.pct}%` }} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Events this week */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-[#10B981]" /> Eventos da semana
            </h2>
            <Link to="/calendar" className="text-xs text-primary hover:underline">Ver calendário</Link>
          </div>
          {weekEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum evento até o fim da semana.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {weekEvents.map(e => {
                const d = new Date(`${e.date}T00:00:00`);
                const isToday = isSameDay(d, today);
                return (
                  <li key={e.id} className="flex items-center gap-3 p-2 rounded-md bg-muted/40">
                    <div className="flex flex-col items-center justify-center w-10 shrink-0">
                      <span className="text-[9px] text-muted-foreground uppercase font-semibold">{format(d, "EEE", { locale: ptBR })}</span>
                      <span className="text-xs font-bold text-foreground">{format(d, "dd/MM")}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{e.title}</p>
                      {e.type && <p className="text-[10px] text-muted-foreground truncate">{e.type}</p>}
                    </div>
                    {isToday && <span className="text-[9px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full shrink-0">Hoje</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Ranking + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ranking */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-[#F97316]" /> Gameficação — Ranking
          </h2>
          {ranking.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum ponto ainda. Conclua demandas com pontos atribuídos para entrar no ranking.</p>
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

        {/* Activity */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#8B5CF6]" /> Atividade recente
          </h2>
          {activity.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma atividade ainda.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {activity.map(a => (
                <li key={a.id} className="flex items-start gap-3">
                  <div
                    className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ backgroundColor: `${a.color}1F`, color: a.color }}
                  >
                    {a.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground leading-snug">{a.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(a.ts)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
