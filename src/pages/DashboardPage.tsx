import React, { useMemo, useState, useEffect } from "react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Trophy, Medal, ListChecks, Megaphone,
  CheckCircle2, FolderPlus, CalendarPlus,
  Sparkles, BarChart2, Star, ClipboardList, Circle, CheckCircle, AlertTriangle,
} from "lucide-react";
import { getNowBrasilia } from "@/lib/utils";
import { format, endOfWeek, differenceInHours, differenceInDays } from "date-fns";
import { AREAS, getTeamColor } from "@/lib/areas";
import { isDemandOverdue, formatDemandDayMonth } from "@/lib/demandStatus";
import FormsSection from "@/components/FormsSection";
import GeneralShortcutsSection from "@/components/GeneralShortcutsSection";

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

type TeamLike = { id: string; name: string };

function getTeamIdFromArea(area?: string | null) {
  return area && /^team_/i.test(area) ? area.slice(5) : null;
}

function resolveDemandScope(areaKey: string, teams: TeamLike[]) {
  const teamId = getTeamIdFromArea(areaKey);
  if (teamId) {
    const team = teams.find(t => t.id === teamId || t.id.toLowerCase() === teamId.toLowerCase());
    return {
      label: team?.name || "Time",
      color: getTeamColor(team?.id || teamId),
    };
  }

  const area = AREAS.find(a => a.key === areaKey);
  return {
    label: area?.label || areaKey,
    color: area?.color || "#00B4D8",
  };
}

export default function DashboardPage() {
  const { people, tasks, projects, events, broadcasts, gamificationAwards, parkingItems, teams, forms, formCompletions, updateParkingItem, loading } = useData();
  const { user } = useAuth();
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

  const hasPendingForms = useMemo(() => {
    if (!user) return false;

    const myPersonIds = new Set(people.filter(person => person.userId === user.id).map(person => person.id));
    const myAreas = new Set<string>();
    people
      .filter(person => myPersonIds.has(person.id))
      .forEach(person => (person.areas || []).forEach(area => myAreas.add(area)));
    const myTeamIds = new Set(
      teams
        .filter(team => team.memberIds.some(personId => myPersonIds.has(personId)))
        .map(team => team.id),
    );
    const completedFormIds = new Set(
      formCompletions
        .filter(completion => completion.userId === user.id)
        .map(completion => completion.formId),
    );

    return forms.some(form => {
      const isEligible = form.targetType === "all"
        || (form.targetType === "area" && !!form.targetValue && myAreas.has(form.targetValue))
        || (form.targetType === "team" && !!form.targetValue && myTeamIds.has(form.targetValue));
      return isEligible && !completedFormIds.has(form.id);
    });
  }, [formCompletions, forms, people, teams, user]);
  const weekEnd = endOfWeek(today, { weekStartsOn: 0 });
  const todayStr = format(today, "yyyy-MM-dd");
  const weekEndStr = format(weekEnd, "yyyy-MM-dd");

  // Ranking — soma TODOS os pontos da gamificação (demandas concluídas + ações manuais)
  const allRanking = useMemo(() => {
    const pointsByPerson: Record<string, number> = {};
    gamificationAwards.forEach(a => {
      pointsByPerson[a.personId] = (pointsByPerson[a.personId] || 0) + (a.points || 0);
    });
    // Conta apelidos repetidos para desambiguar (ex.: dois "Panamá" → "Panamá (Diogo)" / "Panamá (Mateus)")
    const nickCount: Record<string, number> = {};
    people.forEach(p => {
      const nick = p.nickname?.trim().toLowerCase();
      if (nick) nickCount[nick] = (nickCount[nick] || 0) + 1;
    });
    return people
      .map(p => {
        const nick = p.nickname?.trim();
        let label = nick || p.name;
        if (nick && nickCount[nick.toLowerCase()] > 1) {
          label = `${nick} (${p.name.split(" ")[0]})`;
        }
        return { id: p.id, label, points: pointsByPerson[p.id] || 0 };
      })
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
      const scope = resolveDemandScope(p.area, teams);
      const person = people.find(pe => pe.id === p.personId);
      return {
        id: p.id,
        title: p.title,
        areaLabel: scope.label,
        areaColor: scope.color,
        responsible: person?.name ?? "Sem responsável",
      };
    }), [parkingItems, people, teams, todayStr, weekEndStr]);

  const [demandIdx, setDemandIdx] = useState(0);
  const [showAllRanking, setShowAllRanking] = useState(false);
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 50);
    return () => clearTimeout(t);
  }, []);
  const fadeUp = (i: number): React.CSSProperties => ({
    opacity: entered ? 1 : 0,
    transform: entered ? "none" : "translateY(14px)",
    transition: `opacity 0.32s ease-out ${i * 85}ms, transform 0.32s ease-out ${i * 85}ms`,
  });
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
      items.push({ id: `p-${p.id}`, type: "project", label: `Novo projeto "${p.name}" criado`, ts: (p as any).created_at ?? new Date().toISOString(), icon: <FolderPlus className="h-3.5 w-3.5" />, color: "#00B4D8" });
    });
    events.forEach(e => {
      items.push({ id: `e-${e.id}`, type: "event", label: `Evento "${e.title}" agendado`, ts: (e as any).created_at ?? new Date().toISOString(), icon: <CalendarPlus className="h-3.5 w-3.5" />, color: "#F97316" });
    });
    broadcasts.filter(b => !b.message.startsWith("__")).forEach(b => {
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

  return (
    <div className="flex flex-col gap-4 md:block md:space-y-5">
      {/* Resumo pessoal, pendências e Gameficação em ordem dinâmica */}
      <div
        className="contents md:grid md:grid-cols-1 lg:grid-cols-[240px_1fr_minmax(280px,0.6fr)] md:gap-4 md:items-stretch"
        style={fadeUp(0)}
      >
      {currentPerson && (() => {
        const myNickname = (currentPerson.nickname && currentPerson.nickname.trim())
          ? currentPerson.nickname.trim()
          : currentPerson.name;
        const myPoints = allRanking.find(r => r.id === currentPerson.id)?.points || 0;
        const myRankPos = allRanking.findIndex(r => r.id === currentPerson.id);
        const myRankLabel = myRankPos === 0 ? "🥇 1º lugar" : myRankPos === 1 ? "🥈 2º lugar" : myRankPos === 2 ? "🥉 3º lugar" : myRankPos >= 0 ? `${myRankPos + 1}º lugar` : "—";

        return (
          <>
            {/* Minhas Demandas */}
            <div data-tour="my-demands" className={`${myDemands.length > 0 ? "order-2" : "order-[50]"} md:order-2 glass-panel rounded-2xl p-4 md:p-5 h-full flex flex-col`}>
              <h2 className="text-sm font-semibold text-foreground mb-3 md:mb-4 flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-primary" /> Minhas Demandas
              </h2>
              {myDemands.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-6">
                  <CheckCircle className="h-8 w-8 text-emerald-400/50" />
                  <p className="text-xs text-muted-foreground">Nenhuma demanda atribuída. Parabéns! 🎉</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {myDemands.map(demand => {
                    const scope = resolveDemandScope(demand.area, teams);
                    const isOverdue = isDemandOverdue(demand, todayStr);
                    const dayMonth = formatDemandDayMonth(demand.date);
                    return (
                      <div
                        key={demand.id}
                        className="demand-hover flex flex-col gap-3 p-4 rounded-2xl border border-border bg-muted/20"
                        style={{ borderColor: `${scope.color}33`, backgroundColor: `${scope.color}08` }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: scope.color }}>
                              {scope.label}
                            </p>
                            <p className="text-sm font-semibold text-foreground mt-1.5">{demand.title}</p>
                            {demand.description && (
                              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{demand.description}</p>
                            )}
                          </div>
                          {demand.points && (
                            <span className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-md text-white" style={{ backgroundColor: scope.color }}>
                              +{demand.points}p
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          {dayMonth && (
                            <span className="inline-flex shrink-0 items-center justify-center whitespace-nowrap tabular-nums text-[11px] font-medium px-2 py-0.5 rounded-md text-white min-w-[3.5rem]" style={{ backgroundColor: scope.color }}>
                              {dayMonth}
                            </span>
                          )}
                          {!dayMonth && (
                            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] font-semibold px-2 py-0.5 rounded-md text-orange-700 bg-orange-50 border border-orange-300">
                              <AlertTriangle className="h-3 w-3" /> Sem data
                            </span>
                          )}
                          {/* Aviso de status — atrasada (vermelho) ou em andamento (laranja) */}
                          {isOverdue ? (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-red-500/15 text-red-600 flex items-center gap-1">
                              <Circle className="h-2.5 w-2.5 fill-current" /> Atrasada
                            </span>
                          ) : (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-orange-500/15 text-orange-600 flex items-center gap-1">
                              <Circle className="h-2.5 w-2.5 fill-current" /> Em andamento
                            </span>
                          )}
                        </div>
                        <div className="pt-2 border-t border-border/30">
                          <button
                            onClick={async () => { await updateParkingItem({ ...demand, status: "done" }); }}
                            className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-lg transition-all bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm shadow-emerald-500/20"
                          >
                            <CheckCircle className="h-3.5 w-3.5" /> Marcar como concluída
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Formulários */}
            <div className={`${hasPendingForms ? "order-3" : "order-[51]"} md:order-3 h-full`}>
              <FormsSection />
            </div>

            {/* Meus Pontos (Gameficação) */}
            <div data-tour="my-points" className="order-1 glass-panel rounded-2xl p-4 md:p-5 h-full flex flex-col justify-center gap-3 md:gap-4">
              {/* Trophy icon */}
              <div className="flex items-center gap-3 md:flex-col md:text-center">
                <div className="h-12 w-12 md:h-14 md:w-14 rounded-full flex items-center justify-center bg-gradient-to-br from-yellow-400/30 to-orange-400/20 border-2 border-yellow-400/40 shrink-0">
                  <Trophy className="h-6 w-6 md:h-7 md:w-7 text-yellow-500" />
                </div>

                {/* Identity */}
                <div className="space-y-0.5 min-w-0 flex-1 md:flex-none">
                  <div className="flex items-center justify-between gap-3 md:block">
                    <p className="text-base font-bold text-foreground leading-tight truncate">{myNickname}</p>
                    <span className="md:hidden h-14 w-14 rounded-xl border border-primary/20 bg-primary/10 text-3xl font-extrabold text-primary flex items-center justify-center shrink-0">
                      {myPoints}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-muted-foreground md:hidden">{myRankLabel} no ranking</p>
                </div>
              </div>

              {/* Points */}
              <div className="hidden md:block w-full rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 py-3 md:py-4 px-3 text-center">
                <p className="text-3xl font-extrabold text-primary leading-none">{myPoints}</p>
                <p className="text-[11px] font-medium text-muted-foreground mt-1">
                  {myPoints === 1 ? "ponto" : "pontos"}
                </p>
              </div>

              {/* Rank */}
              <p className="hidden md:block text-xs font-semibold text-muted-foreground text-center">{myRankLabel} no ranking</p>
            </div>
          </>
        );
      })()}

      {/* Ranking */}
      <div data-tour="ranking" className="order-4 lg:order-4 lg:col-span-3 glass-panel rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-[#F97316]" /> Gameficação
        </h2>
        {allRanking.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum ponto ainda. Conclua demandas com pontos atribuídos para entrar no ranking.</p>
        ) : (() => {
          const mobileRestRanking = allRanking.slice(5);
          // Split top15 into 3 columns of up to 5 each
          const cols = [top15.slice(0, 5), top15.slice(5, 10), top15.slice(10, 15)];
          // global position offset for correct rank numbers
          const renderItem = (r: typeof top15[0], globalIdx: number) => {
            const medalColor = globalIdx === 0 ? "text-yellow-500" : globalIdx === 1 ? "text-gray-400" : globalIdx === 2 ? "text-amber-700" : "text-muted-foreground";
            return (
              <li key={r.id} className="hover-lift flex items-center gap-2.5 p-2.5 rounded-xl bg-white/62 border border-border/55">
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
              <ol className="sm:hidden flex flex-col gap-2">
                {allRanking.slice(0, 5).map((r, i) => renderItem(r, i))}
              </ol>
              {mobileRestRanking.length > 0 && (
                <div className="sm:hidden">
                  <button
                    type="button"
                    onClick={() => setShowAllRanking(v => !v)}
                    className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                  >
                    {showAllRanking ? "Ver menos ▲" : `Ver mais (${mobileRestRanking.length}) ▼`}
                  </button>
                  {showAllRanking && (
                    <ol className="mt-3 grid grid-cols-1 gap-2">
                      {mobileRestRanking.map((r, i) => (
                        <li key={r.id} className={`hover-lift flex items-center gap-2.5 p-2.5 rounded-xl border border-border/55 ${r.points > 0 ? "bg-white/62" : "bg-white/35 opacity-60"}`}>
                          <span className="w-6 text-center text-xs font-bold text-muted-foreground">{5 + i + 1}</span>
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

              {/* 3 vertical columns side by side */}
              <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
                <div className="hidden sm:block">
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
                        <li key={r.id} className={`hover-lift flex items-center gap-2.5 p-2.5 rounded-xl border border-border/55 ${r.points > 0 ? "bg-white/62" : "bg-white/35 opacity-60"}`}>
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
      </div>

      {/* Atalhos gerais */}
      <div data-tour="shortcuts" className="order-5" style={fadeUp(2)}><GeneralShortcutsSection /></div>

      {/* 2 columns */}
      <div className="hidden md:grid grid-cols-1 lg:grid-cols-2 gap-4" style={fadeUp(3)}>
        {/* Demandas por área */}
        <div className="glass-panel rounded-2xl p-5">
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
        <div className="glass-panel rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-[#10B981]" /> Demandas da semana
          </h2>
          {weekDemands.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma demanda com prazo esta semana.</p>
          ) : (() => {
            const d = weekDemands[demandIdx % weekDemands.length];
            return (
              <div className="flex flex-col gap-3">
                <div className="hover-lift rounded-2xl border border-border/70 bg-white/60 p-4 flex flex-col gap-2 transition-all">
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
      <div className="hidden md:block glass-panel rounded-2xl p-5" style={fadeUp(4)}>
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
