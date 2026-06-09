import { useMemo, useState, useEffect } from "react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Trophy, Medal, ListChecks, Megaphone,
  CheckCircle2, FolderPlus, CalendarPlus, TrendingUp, TrendingDown, Minus,
  Sparkles, BarChart2, Star, ClipboardList, Circle, CheckCircle,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { getNowBrasilia } from "@/lib/utils";
import { format, endOfWeek, differenceInHours, differenceInDays, subDays, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AREAS } from "@/lib/areas";
import buzzupLogo from "@/assets/buzzup-logo.png";

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
  const { people, tasks, projects, events, posts, broadcasts, gamificationAwards, parkingItems, updateParkingItem, loading } = useData();
  const { displayName, user } = useAuth();
  const today = getNowBrasilia();

  // Buscar a pessoa correspondente ao usuário atual
  const currentPerson = useMemo(() => {
    if (!user) return null;
    return people.find(p => p.userId === user.id);
  }, [user, people]);

  // Minhas demandas (atribuídas a mim)
  const myDemands = useMemo(() => {
    if (!currentPerson) return [];
    return parkingItems
      .filter(p => p.personId === currentPerson.id && p.status !== "done")
      .sort((a, b) => {
        // Ordenar por data (mais próximas primeiro)
        if (a.date && b.date) return a.date.localeCompare(b.date);
        if (a.date) return -1;
        if (b.date) return 1;
        return 0;
      });
  }, [currentPerson, parkingItems]);
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
  const allRanking = useMemo(() => {
    const pointsByPerson: Record<string, number> = {};
    gamificationAwards.forEach(a => {
      pointsByPerson[a.personId] = (pointsByPerson[a.personId] || 0) + (a.points || 0);
    });
    return people
      .map(p => ({
        id: p.id,
        label: (p.nickname && p.nickname.trim()) ? p.nickname.trim() : p.name,
        points: pointsByPerson[p.id] || 0,
      }))
      .sort((a, b) => b.points - a.points || a.label.localeCompare(b.label));
  }, [people, gamificationAwards]);
  // Top 15 (3 cols × 5 rows) shown by default; rest shown via "Ver mais"
  const top15 = allRanking.slice(0, 15);
  const restRanking = allRanking.slice(15);
  const restZeroCount = restRanking.filter(r => r.points === 0).length;

  // Demandas por área
  const demandasByArea = AREAS.map(a => ({
    label: a.label,
    color: a.color,
    total: parkingItems.filter(p => p.area === a.key && p.status !== "done").length,
  }));

  // Demandas da semana (rotating cards)
  const weekDemands = useMemo(() => parkingItems
    .filter(p => p.date && p.date >= todayStr && p.date <= weekEndStr && p.status !== "done")
    .map(p => {
      const areaInfo = AREAS.find(a => a.key === p.area);
      const person = people.find(pe => pe.id === p.personId);
      return {
        id: p.id,
        title: p.title,
        areaLabel: areaInfo?.label ?? p.area,
        areaColor: areaInfo?.color ?? "#888",
        responsible: person?.name ?? "Sem responsável",
      };
    }), [parkingItems, people, todayStr, weekEndStr]);

  const [demandIdx, setDemandIdx] = useState(0);
  const [showAllRanking, setShowAllRanking] = useState(false);
  useEffect(() => {
    if (weekDemands.length <= 1) return;
    const timer = setInterval(() => setDemandIdx(i => (i + 1) % weekDemands.length), 2000);
    return () => clearInterval(timer);
  }, [weekDemands.length]);

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
    gamificationAwards.forEach(a => {
      const person = people.find(p => p.id === a.personId);
      const name = person?.name ?? "Alguém";
      items.push({ id: `g-${a.id}`, type: "gamification", label: `+${a.points} pt${a.points > 1 ? "s" : ""} para ${name} — "${a.actionName}"`, ts: a.awardedAt, icon: <Star className="h-3.5 w-3.5" />, color: "#F59E0B" });
    });
    return items
      .filter(i => i.ts)
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
      .slice(0, 10);
  }, [tasks, projects, events, broadcasts, gamificationAwards, people]);

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
          <div className="relative w-full md:w-64 h-32 md:h-36 shrink-0 rounded-xl border border-border/70 overflow-hidden flex items-center justify-center bg-gradient-to-br from-emerald-400/30 via-teal-400/25 to-emerald-300/20">
            <img src={buzzupLogo} alt="BuzzUp" className="h-24 md:h-28 w-auto object-contain drop-shadow-md" />
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

      {/* Minhas Demandas + Meus Pontos */}
      {currentPerson && (() => {
        const myNickname = (currentPerson.nickname && currentPerson.nickname.trim())
          ? currentPerson.nickname.trim()
          : currentPerson.name;
        const myPoints = allRanking.find(r => r.id === currentPerson.id)?.points || 0;
        const myRankPos = allRanking.findIndex(r => r.id === currentPerson.id);
        const myRankLabel = myRankPos === 0 ? "🥇 1º lugar" : myRankPos === 1 ? "🥈 2º lugar" : myRankPos === 2 ? "🥉 3º lugar" : myRankPos >= 0 ? `${myRankPos + 1}º lugar` : "—";

        return (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-4 items-start">
            {/* Minhas Demandas */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-[#2563EB]" /> Minhas Demandas
              </h2>
              {myDemands.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma demanda atribuída. Parabéns! 🎉</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {myDemands.map(demand => {
                    const area = AREAS.find(a => a.key === demand.area);
                    return (
                      <div
                        key={demand.id}
                        className="flex flex-col gap-3 p-4 rounded-lg border border-border bg-muted/20"
                        style={{ borderColor: `${area?.color}33`, backgroundColor: `${area?.color}08` }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: area?.color }}>
                              {area?.label || demand.area}
                            </p>
                            <p className="text-sm font-semibold text-foreground mt-1.5">{demand.title}</p>
                            {demand.description && (
                              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{demand.description}</p>
                            )}
                          </div>
                          {demand.points && (
                            <span className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-md text-white" style={{ backgroundColor: area?.color }}>
                              +{demand.points}p
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          {demand.date && (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md text-white" style={{ backgroundColor: area?.color }}>
                              {new Date(demand.date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2 pt-2 border-t border-border/30">
                          <button
                            onClick={() => updateParkingItem({ ...demand, status: "in-progress" })}
                            className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-md transition-all ${
                              demand.status === "in-progress"
                                ? "bg-orange-500/20 text-orange-600 border border-orange-300"
                                : "bg-muted hover:bg-muted/80 text-muted-foreground"
                            }`}
                          >
                            <Circle className="h-3 w-3" /> Em andamento
                          </button>
                          <button
                            onClick={async () => { await updateParkingItem({ ...demand, status: "done" }); }}
                            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-md transition-all bg-emerald-500/20 text-emerald-600 hover:bg-emerald-500/30 border border-emerald-300"
                          >
                            <CheckCircle className="h-3 w-3" /> Concluído
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Meus Pontos */}
            <div className="bg-card border border-border rounded-xl p-5 flex flex-col items-center text-center gap-4">
              {/* Trophy icon */}
              <div className="h-14 w-14 rounded-full flex items-center justify-center bg-gradient-to-br from-yellow-400/30 to-orange-400/20 border-2 border-yellow-400/40">
                <Trophy className="h-7 w-7 text-yellow-500" />
              </div>

              {/* Identity */}
              <div className="space-y-0.5">
                <p className="text-[11px] font-medium text-muted-foreground">Eu sou</p>
                <p className="text-base font-bold text-foreground leading-tight">{myNickname}</p>
              </div>

              {/* Points */}
              <div className="w-full rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 py-4 px-3">
                <p className="text-3xl font-extrabold text-primary leading-none">{myPoints}</p>
                <p className="text-[11px] font-medium text-muted-foreground mt-1">
                  {myPoints === 1 ? "ponto" : "pontos"}
                </p>
              </div>

              {/* Rank */}
              <p className="text-xs font-semibold text-muted-foreground">{myRankLabel} no ranking</p>
            </div>
          </div>
        );
      })()}

      {/* Ranking */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-[#F97316]" /> Gameficação — Ranking
        </h2>
        {allRanking.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum ponto ainda. Conclua demandas com pontos atribuídos para entrar no ranking.</p>
        ) : (() => {
          // Split top15 into 3 columns of up to 5 each
          const cols = [top15.slice(0, 5), top15.slice(5, 10), top15.slice(10, 15)];
          // global position offset for correct rank numbers
          const renderItem = (r: typeof top15[0], globalIdx: number) => {
            const medalColor = globalIdx === 0 ? "text-yellow-500" : globalIdx === 1 ? "text-gray-400" : globalIdx === 2 ? "text-amber-700" : "text-muted-foreground";
            return (
              <li key={r.id} className="flex items-center gap-2.5 p-2.5 rounded-md bg-muted/40">
                <div className="flex items-center justify-center w-6 h-6 shrink-0">
                  {globalIdx < 3
                    ? <Medal className={`h-4 w-4 ${medalColor}`} />
                    : <span className="text-xs font-bold text-muted-foreground">{globalIdx + 1}</span>}
                </div>
                <span className="flex-1 text-sm font-medium text-foreground truncate">{r.label}</span>
                <span className="text-xs font-bold text-primary whitespace-nowrap">{r.points} pts</span>
              </li>
            );
          };
          return (
            <div className="space-y-4">
              {/* 3 vertical columns side by side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {cols.map((col, ci) => (
                  col.length > 0 && (
                    <ol key={ci} className="flex flex-col gap-2">
                      {col.map((r, ri) => renderItem(r, ci * 5 + ri))}
                    </ol>
                  )
                ))}
              </div>
              {/* Ver mais — posições além do top 15 */}
              {restRanking.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowAllRanking(v => !v)}
                    className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                  >
                    {showAllRanking
                      ? "Ver menos ▲"
                      : restZeroCount > 0
                        ? `Ver mais (${restRanking.length - restZeroCount} com pontos + ${restZeroCount} com 0) ▼`
                        : `Ver mais (${restRanking.length}) ▼`}
                  </button>
                  {showAllRanking && (
                    <ol className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {restRanking.map((r, i) => (
                        <li key={r.id} className={`flex items-center gap-2.5 p-2.5 rounded-md ${r.points > 0 ? "bg-muted/40" : "bg-muted/20 opacity-60"}`}>
                          <span className="w-6 text-center text-xs font-bold text-muted-foreground">{top15.length + i + 1}</span>
                          <span className="flex-1 text-sm font-medium text-foreground truncate">{r.label}</span>
                          <span className={`text-xs font-bold ${r.points > 0 ? "text-primary" : "text-muted-foreground"}`}>
                            {r.points} pts
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Demandas por área */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-[#F97316]" /> Demandas por área
          </h2>
          {demandasByArea.every(a => a.total === 0) ? (
            <p className="text-xs text-muted-foreground">Sem demandas ativas.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {demandasByArea.map((a) => (
                <div key={a.label} className="flex items-center gap-3">
                  <span
                    className="shrink-0 text-[11px] font-semibold leading-tight"
                    style={{ color: a.color, minWidth: "7rem" }}
                  >
                    {a.label}
                  </span>
                  <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${demandasByArea.every(x => x.total === 0) ? 0 : Math.max(4, Math.round((a.total / Math.max(...demandasByArea.map(x => x.total), 1)) * 100))}%`,
                        backgroundColor: a.color,
                      }}
                    />
                  </div>
                  <span className="shrink-0 text-xs font-bold text-foreground w-5 text-right">{a.total}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Demandas da semana — carrossel */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-[#10B981]" /> Demandas da semana
          </h2>
          {weekDemands.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma demanda com prazo esta semana.</p>
          ) : (() => {
            const d = weekDemands[demandIdx % weekDemands.length];
            return (
              <div className="flex flex-col gap-3">
                <div className="rounded-lg border border-border bg-muted/30 p-4 flex flex-col gap-2 transition-all">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: d.areaColor }} />
                    <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: d.areaColor }}>{d.areaLabel}</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground leading-snug">{d.title}</p>
                  <p className="text-xs text-muted-foreground">Responsável: <span className="font-medium text-foreground">{d.responsible}</span></p>
                </div>
                {weekDemands.length > 1 && (
                  <div className="flex items-center justify-center gap-1">
                    {weekDemands.map((_, i) => (
                      <button key={i} onClick={() => setDemandIdx(i)}
                        className={`h-1.5 rounded-full transition-all ${i === demandIdx % weekDemands.length ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30"}`} />
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Atividade recente */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#8B5CF6]" /> Atividade recente
        </h2>
        {activity.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma atividade ainda.</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
  );
}
