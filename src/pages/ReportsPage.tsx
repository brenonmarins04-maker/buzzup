import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { supabase } from "@/integrations/supabase/client";
import { AREAS_DEFAULT, getAreaLabel, getAreaColor } from "@/lib/areas";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { BarChart2, Users, Trophy, Clock, ChevronLeft } from "lucide-react";

type TimeSlot = "morning" | "afternoon" | "night";

const DAYS_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const SLOTS: { key: TimeSlot; label: string }[] = [
  { key: "morning",   label: "Manhã (06–12)" },
  { key: "afternoon", label: "Tarde (12–19)" },
  { key: "night",     label: "Noite (19–06)" },
];

function getTimeSlot(hour: number): TimeSlot {
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 19) return "afternoon";
  return "night";
}

function heatColor(count: number, max: number): string {
  if (max === 0 || count === 0) return "rgba(99,102,241,0.05)";
  const ratio = count / max;
  const alpha = 0.1 + ratio * 0.85;
  return `rgba(99,102,241,${alpha.toFixed(2)})`;
}

function heatTextColor(count: number, max: number): string {
  if (max === 0 || count === 0) return "var(--muted-foreground)";
  const ratio = count / max;
  return ratio > 0.5 ? "#fff" : "var(--foreground)";
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-md text-xs">
      <p className="font-semibold text-foreground mb-0.5">{label}</p>
      <p style={{ color: payload[0].fill }}>{payload[0].value} {payload[0].name === "pts" ? "pontos" : "entradas"}</p>
    </div>
  );
};

export default function ReportsPage() {
  const navigate = useNavigate();
  const { isAdmin, activeWorkspaceId } = useAuth();
  const { gamificationAwards, parkingItems, people } = useData();

  const [loginsByArea, setLoginsByArea] = useState<Record<string, number>>({});
  const [loadingLogins, setLoadingLogins] = useState(true);
  const [drillArea, setDrillArea] = useState<string | null>(null);

  // Guard — non-admins go back to home
  useEffect(() => {
    if (!isAdmin) navigate("/");
  }, [isAdmin, navigate]);

  // Load user_daily_logins for last 30 days and group by area
  useEffect(() => {
    if (!activeWorkspaceId || !people.length) return;
    setLoadingLogins(true);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const since = thirtyDaysAgo.toISOString().split("T")[0];

    (supabase.from("user_daily_logins") as any)
      .select("user_id")
      .eq("workspace_id", activeWorkspaceId)
      .gte("login_date", since)
      .then(({ data }: { data: { user_id: string }[] | null }) => {
        const byArea: Record<string, number> = {};
        AREAS_DEFAULT.forEach(a => { byArea[a.key] = 0; });
        (data || []).forEach(row => {
          const person = people.find(p => p.userId === row.user_id);
          if (!person) return;
          const areas = person.areas?.length ? person.areas : (person.area ? [person.area] : []);
          areas.forEach(aKey => { byArea[aKey] = (byArea[aKey] ?? 0) + 1; });
        });
        setLoginsByArea(byArea);
        setLoadingLogins(false);
      });
  }, [activeWorkspaceId, people]);

  // Points by area — from gamificationAwards + people lookup
  const pointsData = useMemo(() => {
    const byArea: Record<string, number> = {};
    AREAS_DEFAULT.forEach(a => { byArea[a.key] = 0; });
    gamificationAwards.forEach(award => {
      const person = people.find(p => p.id === award.personId);
      if (!person) return;
      const areas = person.areas?.length ? person.areas : (person.area ? [person.area] : []);
      areas.forEach(aKey => { byArea[aKey] = (byArea[aKey] ?? 0) + award.points; });
    });
    return AREAS_DEFAULT.map(a => ({
      key: a.key,
      label: getAreaLabel(a.key) || a.label,
      pts: byArea[a.key] || 0,
      color: getAreaColor(a.key),
    }));
  }, [gamificationAwards, people]);

  // Drill-down: pontos por pessoa dentro da área selecionada
  const drillData = useMemo(() => {
    if (!drillArea) return [];
    const byPerson: Record<string, { name: string; pts: number }> = {};
    gamificationAwards.forEach(award => {
      const person = people.find(p => p.id === award.personId);
      if (!person) return;
      const areas = person.areas?.length ? person.areas : (person.area ? [person.area] : []);
      if (!areas.includes(drillArea)) return;
      if (!byPerson[award.personId]) byPerson[award.personId] = { name: person.nickname || person.name, pts: 0 };
      byPerson[award.personId].pts += award.points;
    });
    return Object.values(byPerson).sort((a, b) => b.pts - a.pts);
  }, [drillArea, gamificationAwards, people]);

  // Logins chart data
  const loginData = useMemo(() =>
    AREAS_DEFAULT.map(a => ({
      label: getAreaLabel(a.key) || a.label,
      entradas: loginsByArea[a.key] || 0,
      color: getAreaColor(a.key),
    })),
    [loginsByArea]
  );

  // Heatmap — parking_items with completedAt grouped by dayOfWeek × timeSlot
  const heatmap = useMemo(() => {
    const grid: Record<string, number> = {};
    for (let d = 0; d < 7; d++) {
      for (const s of SLOTS) { grid[`${d}-${s.key}`] = 0; }
    }
    parkingItems.forEach(item => {
      if (item.status !== "done" || !item.completedAt) return;
      const date = new Date(item.completedAt);
      const day = date.getDay();
      const slot = getTimeSlot(date.getHours());
      grid[`${day}-${slot}`] = (grid[`${day}-${slot}`] || 0) + 1;
    });
    return grid;
  }, [parkingItems]);

  const maxHeat = Math.max(0, ...Object.values(heatmap));
  const totalHeatItems = Object.values(heatmap).reduce((a, b) => a + b, 0);

  if (!isAdmin) return null;

  return (
    <div className="animate-fade-in space-y-8 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <BarChart2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Relatórios</h1>
          <p className="text-xs text-muted-foreground">Visão geral de atividades — últimos 30 dias</p>
        </div>
      </div>

      {/* Row: Charts side by side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Chart 1: Pontos por área / drill-down por pessoa */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-5">
            {drillArea ? (
              <>
                <button
                  onClick={() => setDrillArea(null)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Voltar
                </button>
                <span className="text-muted-foreground">·</span>
                <Trophy className="h-4 w-4 text-amber-500" />
                <h2 className="text-sm font-semibold text-foreground">
                  Pontos por Pessoa —{" "}
                  <span style={{ color: getAreaColor(drillArea) }}>
                    {getAreaLabel(drillArea) || AREAS_DEFAULT.find(a => a.key === drillArea)?.label}
                  </span>
                </h2>
              </>
            ) : (
              <>
                <Trophy className="h-4 w-4 text-amber-500" />
                <h2 className="text-sm font-semibold text-foreground">Pontos por Área (Gamificação)</h2>
                <span className="text-[10px] text-muted-foreground ml-auto">clique numa barra para detalhes</span>
              </>
            )}
          </div>

          {drillArea ? (
            drillData.length === 0 ? (
              <div className="flex items-center justify-center h-[220px]">
                <p className="text-xs text-muted-foreground">Nenhum ponto registrado nessa área.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={drillData} barSize={28} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--accent)", opacity: 0.5 }} />
                  <Bar dataKey="pts" radius={[6, 6, 0, 0]} fill={getAreaColor(drillArea)} />
                </BarChart>
              </ResponsiveContainer>
            )
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={pointsData}
                  barSize={36}
                  margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                  style={{ cursor: "pointer" }}
                >
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--accent)", opacity: 0.5 }} />
                  <Bar dataKey="pts" radius={[6, 6, 0, 0]} onClick={(data: any) => setDrillArea(data.key)}>
                    {pointsData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {pointsData.every(d => d.pts === 0) && (
                <p className="text-xs text-muted-foreground text-center mt-2">Nenhum ponto registrado ainda.</p>
              )}
            </>
          )}
        </div>

        {/* Chart 2: Entradas por área */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <Users className="h-4 w-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-foreground">Entradas no BuzzUp por Área</h2>
            <span className="text-[10px] text-muted-foreground ml-auto">últimos 30 dias</span>
          </div>
          {loadingLogins ? (
            <div className="flex items-center justify-center h-[220px]">
              <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={loginData} barSize={36} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--accent)", opacity: 0.5 }} />
                <Bar dataKey="entradas" radius={[6, 6, 0, 0]}>
                  {loginData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          {!loadingLogins && loginData.every(d => d.entradas === 0) && (
            <p className="text-xs text-muted-foreground text-center mt-2">Dados sendo coletados a partir de agora.</p>
          )}
        </div>
      </div>

      {/* Heatmap */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-5">
          <Clock className="h-4 w-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-foreground">Tarefas Concluídas por Dia e Período</h2>
          {totalHeatItems === 0 && (
            <span className="ml-auto text-[10px] bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full font-medium">
              Dados sendo coletados
            </span>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 mb-4 justify-end">
          <span className="text-[10px] text-muted-foreground">Menos</span>
          <div className="flex gap-1">
            {[0.05, 0.25, 0.5, 0.75, 1].map((r, i) => (
              <div key={i} className="h-4 w-4 rounded" style={{ backgroundColor: `rgba(99,102,241,${r})` }} />
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground">Mais</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-separate border-spacing-1.5">
            <thead>
              <tr>
                <th className="text-[10px] font-medium text-muted-foreground text-left pr-3 pb-1 w-32"></th>
                {DAYS_LABELS.map(d => (
                  <th key={d} className="text-[10px] font-semibold text-muted-foreground text-center pb-1">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SLOTS.map(slot => (
                <tr key={slot.key}>
                  <td className="text-[10px] text-muted-foreground pr-3 py-0.5 whitespace-nowrap">{slot.label}</td>
                  {DAYS_LABELS.map((_, dayIdx) => {
                    const count = heatmap[`${dayIdx}-${slot.key}`] || 0;
                    const bg = heatColor(count, maxHeat);
                    const color = heatTextColor(count, maxHeat);
                    return (
                      <td key={dayIdx} className="text-center">
                        <div
                          className="rounded-lg flex items-center justify-center mx-auto text-[11px] font-semibold transition-all"
                          style={{ backgroundColor: bg, color, width: "100%", minWidth: 36, height: 40 }}
                          title={`${DAYS_LABELS[dayIdx]} – ${slot.label}: ${count} tarefa${count !== 1 ? "s" : ""}`}
                        >
                          {count > 0 ? count : ""}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalHeatItems === 0 && (
          <p className="text-xs text-muted-foreground text-center mt-4">
            A partir de agora, cada demanda concluída será registrada e aparecerá aqui.
          </p>
        )}
      </div>
    </div>
  );
}
