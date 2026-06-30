import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { supabase } from "@/integrations/supabase/client";
import { AREAS_DEFAULT, getAreaLabel, getAreaColor } from "@/lib/areas";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { BarChart2, Users, Trophy, Clock, ChevronLeft, CalendarDays } from "lucide-react";

type TimeSlot = "morning" | "afternoon" | "night";
type Preset = "7d" | "30d" | "3m" | "6m" | "custom";

const DAYS_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const SLOTS: { key: TimeSlot; label: string }[] = [
  { key: "morning",   label: "Manhã (06–12)" },
  { key: "afternoon", label: "Tarde (12–19)" },
  { key: "night",     label: "Noite (19–06)" },
];
const PRESETS: { key: Preset; label: string }[] = [
  { key: "7d",  label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "3m",  label: "3 meses" },
  { key: "6m",  label: "6 meses" },
  { key: "custom", label: "Personalizado" },
];

function toDateStr(d: Date) {
  return d.toISOString().split("T")[0];
}
function fromPreset(preset: Preset): { start: string; end: string } {
  const end = toDateStr(new Date());
  const s = new Date();
  if (preset === "7d")  { s.setDate(s.getDate() - 7); }
  else if (preset === "30d") { s.setDate(s.getDate() - 30); }
  else if (preset === "3m")  { s.setMonth(s.getMonth() - 3); }
  else if (preset === "6m")  { s.setMonth(s.getMonth() - 6); }
  return { start: toDateStr(s), end };
}

function getTimeSlot(hour: number): TimeSlot {
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 19) return "afternoon";
  return "night";
}

function heatColor(count: number, max: number): string {
  if (max === 0 || count === 0) return "rgba(99,102,241,0.05)";
  const alpha = 0.1 + (count / max) * 0.85;
  return `rgba(99,102,241,${alpha.toFixed(2)})`;
}
function heatTextColor(count: number, max: number): string {
  if (max === 0 || count === 0) return "var(--muted-foreground)";
  return count / max > 0.5 ? "#fff" : "var(--foreground)";
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-md text-xs">
      <p className="font-semibold text-foreground mb-0.5">{label}</p>
      <p style={{ color: payload[0].fill ?? payload[0].color }}>
        {payload[0].value} {payload[0].name === "pts" ? "pontos" : "entradas"}
      </p>
    </div>
  );
};

export default function ReportsPage() {
  const navigate = useNavigate();
  const { isAdmin, activeWorkspaceId } = useAuth();
  const { gamificationAwards, parkingItems, people } = useData();

  // Date range
  const [preset, setPreset] = useState<Preset>("30d");
  const [dateRange, setDateRange] = useState(() => fromPreset("30d"));
  const [customStart, setCustomStart] = useState(dateRange.start);
  const [customEnd, setCustomEnd]   = useState(dateRange.end);

  const applyPreset = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") {
      const r = fromPreset(p);
      setDateRange(r);
      setCustomStart(r.start);
      setCustomEnd(r.end);
    }
  };
  const applyCustom = () => {
    if (customStart && customEnd && customStart <= customEnd) {
      setDateRange({ start: customStart, end: customEnd });
    }
  };

  // Logins (entradas) state — linhas brutas, agregadas por área e por pessoa via useMemo
  const [loginRows, setLoginRows] = useState<{ user_id: string }[]>([]);
  const [loadingLogins, setLoadingLogins] = useState(true);

  // Drill-down
  const [drillArea, setDrillArea] = useState<string | null>(null);
  const [loginDrillArea, setLoginDrillArea] = useState<string | null>(null);

  // Guard
  useEffect(() => { if (!isAdmin) navigate("/"); }, [isAdmin, navigate]);

  // Fetch logins (entradas) whenever workspace or date range changes
  useEffect(() => {
    if (!activeWorkspaceId) return;
    setLoadingLogins(true);

    (supabase.from("user_daily_logins") as any)
      .select("user_id")
      .eq("workspace_id", activeWorkspaceId)
      .gte("login_date", dateRange.start)
      .lte("login_date", dateRange.end)
      .then(({ data }: { data: { user_id: string }[] | null }) => {
        setLoginRows(data || []);
        setLoadingLogins(false);
      });
  }, [activeWorkspaceId, dateRange]);

  // Points by area filtered by date range
  const pointsData = useMemo(() => {
    const byArea: Record<string, number> = {};
    AREAS_DEFAULT.forEach(a => { byArea[a.key] = 0; });
    gamificationAwards.forEach(award => {
      const awardDate = award.awardedAt.split("T")[0];
      if (awardDate < dateRange.start || awardDate > dateRange.end) return;
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
  }, [gamificationAwards, people, dateRange]);

  // Drill-down: pontos por pessoa na área selecionada (filtered)
  const drillData = useMemo(() => {
    if (!drillArea) return [];
    const byPerson: Record<string, { name: string; pts: number }> = {};
    gamificationAwards.forEach(award => {
      const awardDate = award.awardedAt.split("T")[0];
      if (awardDate < dateRange.start || awardDate > dateRange.end) return;
      const person = people.find(p => p.id === award.personId);
      if (!person) return;
      const areas = person.areas?.length ? person.areas : (person.area ? [person.area] : []);
      if (!areas.includes(drillArea)) return;
      if (!byPerson[award.personId]) {
        const firstName = person.name.split(" ")[0];
        const label = person.nickname ? `${firstName} (${person.nickname})` : firstName;
        byPerson[award.personId] = { name: label, pts: 0 };
      }
      byPerson[award.personId].pts += award.points;
    });
    return Object.values(byPerson).sort((a, b) => b.pts - a.pts);
  }, [drillArea, gamificationAwards, people, dateRange]);

  // Entradas por área (chart 2)
  const loginData = useMemo(() => {
    const byArea: Record<string, number> = {};
    AREAS_DEFAULT.forEach(a => { byArea[a.key] = 0; });
    loginRows.forEach(row => {
      const person = people.find(p => p.userId === row.user_id);
      if (!person) return;
      const areas = person.areas?.length ? person.areas : (person.area ? [person.area] : []);
      areas.forEach(aKey => { byArea[aKey] = (byArea[aKey] ?? 0) + 1; });
    });
    return AREAS_DEFAULT.map(a => ({
      key: a.key,
      label: getAreaLabel(a.key) || a.label,
      entradas: byArea[a.key] || 0,
      color: getAreaColor(a.key),
    }));
  }, [loginRows, people]);

  // Drill-down: entradas por pessoa na área selecionada (filtered)
  const loginDrillData = useMemo(() => {
    if (!loginDrillArea) return [];
    const byPerson: Record<string, { name: string; entradas: number }> = {};
    loginRows.forEach(row => {
      const person = people.find(p => p.userId === row.user_id);
      if (!person) return;
      const areas = person.areas?.length ? person.areas : (person.area ? [person.area] : []);
      if (!areas.includes(loginDrillArea)) return;
      if (!byPerson[person.id]) {
        const firstName = person.name.split(" ")[0];
        const label = person.nickname ? `${firstName} (${person.nickname})` : firstName;
        byPerson[person.id] = { name: label, entradas: 0 };
      }
      byPerson[person.id].entradas += 1;
    });
    return Object.values(byPerson).sort((a, b) => b.entradas - a.entradas);
  }, [loginDrillArea, loginRows, people]);

  // Heatmap
  const heatmap = useMemo(() => {
    const grid: Record<string, number> = {};
    for (let d = 0; d < 7; d++) {
      for (const s of SLOTS) { grid[`${d}-${s.key}`] = 0; }
    }
    parkingItems.forEach(item => {
      if (item.status !== "done" || !item.completedAt) return;
      const date = new Date(item.completedAt);
      grid[`${date.getDay()}-${getTimeSlot(date.getHours())}`] =
        (grid[`${date.getDay()}-${getTimeSlot(date.getHours())}`] || 0) + 1;
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
          <p className="text-xs text-muted-foreground">Visão geral de atividades do workspace</p>
        </div>
      </div>

      {/* Seletor de período — compartilhado entre os dois gráficos */}
      <div className="bg-card border border-border rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground shrink-0">
          <CalendarDays className="h-3.5 w-3.5" />
          Período:
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {PRESETS.map(p => (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                preset === p.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === "custom" && (
          <div className="flex items-center gap-2 ml-1">
            <input
              type="date"
              value={customStart}
              max={customEnd}
              onChange={e => setCustomStart(e.target.value)}
              className="text-xs border border-input rounded-md px-2 py-1 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <span className="text-xs text-muted-foreground">até</span>
            <input
              type="date"
              value={customEnd}
              min={customStart}
              max={toDateStr(new Date())}
              onChange={e => setCustomEnd(e.target.value)}
              className="text-xs border border-input rounded-md px-2 py-1 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={applyCustom}
              className="px-3 py-1 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Aplicar
            </button>
          </div>
        )}

        {preset !== "custom" && (
          <span className="text-[11px] text-muted-foreground ml-auto">
            {dateRange.start} → {dateRange.end}
          </span>
        )}
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
                <p className="text-xs text-muted-foreground">Nenhum ponto nessa área no período.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={drillData} barSize={24} margin={{ top: 4, right: 8, left: -16, bottom: 60 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    axisLine={false} tickLine={false}
                    interval={0} angle={-40} textAnchor="end"
                  />
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
                  onClick={(data: any) => {
                    const key = data?.activePayload?.[0]?.payload?.key;
                    if (key) setDrillArea(key);
                  }}
                >
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--accent)", opacity: 0.5 }} />
                  <Bar dataKey="pts" radius={[6, 6, 0, 0]}>
                    {pointsData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {pointsData.every(d => d.pts === 0) && (
                <p className="text-xs text-muted-foreground text-center mt-2">Nenhum ponto registrado no período.</p>
              )}
            </>
          )}
        </div>

        {/* Chart 2: Entradas por área / drill-down por pessoa */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-5">
            {loginDrillArea ? (
              <>
                <button
                  onClick={() => setLoginDrillArea(null)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Voltar
                </button>
                <span className="text-muted-foreground">·</span>
                <Users className="h-4 w-4 text-blue-500" />
                <h2 className="text-sm font-semibold text-foreground">
                  Entradas por Pessoa —{" "}
                  <span style={{ color: getAreaColor(loginDrillArea) }}>
                    {getAreaLabel(loginDrillArea) || AREAS_DEFAULT.find(a => a.key === loginDrillArea)?.label}
                  </span>
                </h2>
              </>
            ) : (
              <>
                <Users className="h-4 w-4 text-blue-500" />
                <h2 className="text-sm font-semibold text-foreground">Entradas no BuzzUp por Área</h2>
                <span className="text-[10px] text-muted-foreground ml-auto">clique numa barra para detalhes</span>
              </>
            )}
          </div>

          {loadingLogins ? (
            <div className="flex items-center justify-center h-[220px]">
              <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : loginDrillArea ? (
            loginDrillData.length === 0 ? (
              <div className="flex items-center justify-center h-[220px]">
                <p className="text-xs text-muted-foreground">Nenhuma entrada registrada nessa área no período.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={loginDrillData} barSize={24} margin={{ top: 4, right: 8, left: -16, bottom: 60 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    axisLine={false} tickLine={false}
                    interval={0} angle={-40} textAnchor="end"
                  />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--accent)", opacity: 0.5 }} />
                  <Bar dataKey="entradas" radius={[6, 6, 0, 0]} fill={getAreaColor(loginDrillArea)} />
                </BarChart>
              </ResponsiveContainer>
            )
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={loginData}
                  barSize={36}
                  margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                  style={{ cursor: "pointer" }}
                  onClick={(data: any) => {
                    const key = data?.activePayload?.[0]?.payload?.key;
                    if (key) setLoginDrillArea(key);
                  }}
                >
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
              {loginData.every(d => d.entradas === 0) && (
                <p className="text-xs text-muted-foreground text-center mt-2">Dados sendo coletados a partir de agora.</p>
              )}
            </>
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
                    return (
                      <td key={dayIdx} className="text-center">
                        <div
                          className="rounded-lg flex items-center justify-center mx-auto text-[11px] font-semibold transition-all"
                          style={{ backgroundColor: heatColor(count, maxHeat), color: heatTextColor(count, maxHeat), width: "100%", minWidth: 36, height: 40 }}
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
