// Ciclos de gamificação: períodos nomeados criados pelo diretor.
// Com um ciclo ativo, o ranking do workspace conta só os pontos daquele período.

export type GamificationCycle = {
  id: string;
  name: string;
  /** YYYY-MM-DD — pontos anteriores a esta data não contam */
  start: string;
  /** YYYY-MM-DD — vazio = ciclo em andamento (sem data final) */
  end: string;
};

export type CyclesState = { cycles: GamificationCycle[]; activeId: string | null };

export const EMPTY_CYCLES: CyclesState = { cycles: [], activeId: null };

export function makeCycleId(): string {
  return `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const isDateStr = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Aceita o que vier do banco e devolve um estado sempre utilizável. */
export function normalizeCycles(raw: unknown): CyclesState {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const list = Array.isArray(obj.cycles) ? obj.cycles : [];

  const cycles: GamificationCycle[] = list
    .map(item => {
      const c = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
      if (typeof c.id !== "string" || !c.id) return null;
      if (!isDateStr(c.start)) return null;
      return {
        id: c.id,
        name: typeof c.name === "string" && c.name.trim() ? c.name.trim() : "Ciclo",
        start: c.start,
        end: isDateStr(c.end) ? c.end : "",
      };
    })
    .filter((c): c is GamificationCycle => c !== null)
    // mais recentes primeiro
    .sort((a, b) => b.start.localeCompare(a.start));

  const activeId = typeof obj.activeId === "string" && cycles.some(c => c.id === obj.activeId)
    ? obj.activeId
    : null;

  return { cycles, activeId };
}

export function findActiveCycle(state: CyclesState): GamificationCycle | null {
  if (!state.activeId) return null;
  return state.cycles.find(c => c.id === state.activeId) ?? null;
}

/** A data (YYYY-MM-DD ou ISO) está dentro do ciclo? Sem ciclo, tudo conta. */
export function isInCycle(dateIso: string | null | undefined, cycle: GamificationCycle | null): boolean {
  if (!cycle) return true;
  if (!dateIso) return false;
  const day = dateIso.slice(0, 10);
  if (day < cycle.start) return false;
  if (cycle.end && day > cycle.end) return false;
  return true;
}

export function formatCycleRange(cycle: GamificationCycle): string {
  const fmt = (d: string) => {
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y.slice(2)}`;
  };
  return cycle.end ? `${fmt(cycle.start)} – ${fmt(cycle.end)}` : `desde ${fmt(cycle.start)}`;
}
