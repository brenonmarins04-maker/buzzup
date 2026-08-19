import { useEffect, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";

export type Preset = "7d" | "30d" | "3m" | "6m" | "custom" | "cycle";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "3m", label: "3 meses" },
  { key: "6m", label: "6 meses" },
  { key: "custom", label: "Datas" },
];

export function toDateStr(d: Date) {
  return d.toISOString().split("T")[0];
}

/** Data local (sem shift de fuso) — usada pelas chaves de semana. */
export function toLocalStr(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Segunda-feira (00:00 local) da semana que contém `d`. */
export function mondayOf(d: Date) {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7; // Seg=0 ... Dom=6
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function fromPreset(preset: Preset): { start: string; end: string } {
  const end = toDateStr(new Date());
  const s = new Date();
  if (preset === "7d") s.setDate(s.getDate() - 7);
  else if (preset === "30d") s.setDate(s.getDate() - 30);
  else if (preset === "3m") s.setMonth(s.getMonth() - 3);
  else if (preset === "6m") s.setMonth(s.getMonth() - 6);
  return { start: toDateStr(s), end };
}

export type ReportFilter = ReturnType<typeof useReportFilter>;

/**
 * Filtro independente de um gráfico: período (atalhos ou intervalo de datas)
 * + recorte por semana. Cada gráfico do relatório usa a sua própria instância.
 */
export function useReportFilter(initial: Preset = "30d") {
  const [preset, setPreset] = useState<Preset>(initial);
  const [dateRange, setDateRange] = useState(() => fromPreset(initial));
  const [customStart, setCustomStart] = useState(dateRange.start);
  const [customEnd, setCustomEnd] = useState(dateRange.end);
  const [weekFilter, setWeekFilter] = useState<string>("");
  const [cycleId, setCycleId] = useState<string | null>(null);

  // Trocar o período zera a semana escolhida (ela pode nem existir mais)
  useEffect(() => { setWeekFilter(""); }, [dateRange]);

  const applyPreset = (p: Preset) => {
    if (p === "cycle") return; // ciclo entra por applyCycle
    setPreset(p);
    setCycleId(null);
    if (p !== "custom") {
      const r = fromPreset(p);
      setDateRange(r);
      setCustomStart(r.start);
      setCustomEnd(r.end);
    }
  };

  /** Usa o período de um ciclo da gamificação como janela do gráfico. */
  const applyCycle = (cycle: { id: string; start: string; end: string } | null) => {
    if (!cycle) { applyPreset("30d"); return; }
    setPreset("cycle");
    setCycleId(cycle.id);
    // Ciclo em andamento (sem fim) vai até hoje
    setDateRange({ start: cycle.start, end: cycle.end || toDateStr(new Date()) });
  };

  const applyCustom = () => {
    if (customStart && customEnd && customStart <= customEnd) {
      setCycleId(null);
      setPreset("custom");
      setDateRange({ start: customStart, end: customEnd });
    }
  };

  // Semanas (Seg–Dom) que se sobrepõem ao período, mais recentes primeiro
  const availableWeeks = useMemo(() => {
    const min = mondayOf(new Date(dateRange.start + "T00:00:00"));
    let cur = mondayOf(new Date(dateRange.end + "T00:00:00"));
    const weeks: { key: string; label: string }[] = [];
    while (cur >= min && weeks.length < 27) {
      const end = new Date(cur); end.setDate(end.getDate() + 6);
      const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      weeks.push({ key: toLocalStr(cur), label: `${fmt(cur)} – ${fmt(end)}` });
      cur = new Date(cur); cur.setDate(cur.getDate() - 7);
    }
    return weeks;
  }, [dateRange]);

  /** Janela efetiva: a semana escolhida, senão o período inteiro. */
  const range = useMemo(() => {
    if (weekFilter) {
      const start = new Date(weekFilter + "T00:00:00");
      const end = new Date(start); end.setDate(end.getDate() + 6);
      return { start: toLocalStr(start), end: toLocalStr(end) };
    }
    return dateRange;
  }, [weekFilter, dateRange]);

  const inWindow = useMemo(() => {
    const start = new Date(range.start + "T00:00:00");
    const endExcl = new Date(range.end + "T00:00:00");
    endExcl.setDate(endExcl.getDate() + 1);
    return (d: Date) => d >= start && d < endExcl;
  }, [range]);

  /** Compara uma data em texto (YYYY-MM-DD) com a janela. */
  const inWindowStr = useMemo(
    () => (s?: string | null) => !!s && s >= range.start && s <= range.end,
    [range],
  );

  return {
    preset, applyPreset,
    cycleId, applyCycle,
    dateRange, range,
    customStart, setCustomStart,
    customEnd, setCustomEnd, applyCustom,
    weekFilter, setWeekFilter, availableWeeks,
    inWindow, inWindowStr,
  };
}

export type CycleOption = { id: string; name: string; start: string; end: string };

/** Barra de filtros compacta, exibida dentro do card de cada gráfico. */
export function ReportFilterBar({ filter, cycles = [] }: { filter: ReportFilter; cycles?: CycleOption[] }) {
  const {
    preset, applyPreset, cycleId, applyCycle,
    customStart, setCustomStart, customEnd, setCustomEnd, applyCustom,
    weekFilter, setWeekFilter, availableWeeks, dateRange,
  } = filter;

  return (
    <div className="rounded-xl border border-border/70 bg-muted/25 p-2.5 mb-4 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        {PRESETS.map(p => (
          <button
            key={p.key}
            onClick={() => applyPreset(p.key)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
              preset === p.key
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
            }`}
          >
            {p.label}
          </button>
        ))}
        {cycles.length > 0 && (
          <select
            value={cycleId ?? ""}
            onChange={e => applyCycle(cycles.find(c => c.id === e.target.value) ?? null)}
            title="Filtrar pelo período de um ciclo da gamificação"
            className={`h-[26px] px-2 rounded-full text-[11px] font-medium border transition-colors ${
              preset === "cycle"
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground bg-background hover:text-foreground"
            }`}
          >
            <option value="">Ciclo…</option>
            {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        {preset !== "custom" && (
          <span className="text-[10px] text-muted-foreground/70 ml-auto">
            {dateRange.start} → {dateRange.end}
          </span>
        )}
      </div>

      {/* Intervalo personalizado: de uma data até outra */}
      {preset === "custom" && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-medium text-muted-foreground">De</span>
          <input
            type="date"
            value={customStart}
            max={customEnd}
            onChange={e => setCustomStart(e.target.value)}
            className="text-[11px] border border-input rounded-md px-2 py-1 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <span className="text-[10px] font-medium text-muted-foreground">até</span>
          <input
            type="date"
            value={customEnd}
            min={customStart}
            max={toDateStr(new Date())}
            onChange={e => setCustomEnd(e.target.value)}
            className="text-[11px] border border-input rounded-md px-2 py-1 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={applyCustom}
            className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Aplicar
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-medium text-muted-foreground shrink-0">Semana:</span>
        <select
          value={weekFilter}
          onChange={e => setWeekFilter(e.target.value)}
          className="h-7 px-2 rounded-md border border-input bg-background text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">Todas do período</option>
          {availableWeeks.map(w => (
            <option key={w.key} value={w.key}>{w.label}</option>
          ))}
        </select>
        {weekFilter && (
          <button onClick={() => setWeekFilter("")} className="text-[10px] text-primary hover:underline">
            limpar
          </button>
        )}
      </div>
    </div>
  );
}
