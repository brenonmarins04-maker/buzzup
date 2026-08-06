// Valores rápidos de pontuação das demandas, configuráveis por workspace.
// Padrão histórico: 1, 2 e 3.

export const DEFAULT_DEMAND_POINTS = [1, 2, 3];
export const MAX_DEMAND_POINT = 99;
export const MAX_DEMAND_POINT_OPTIONS = 6;

const cache = new Map<string, number[]>();
let _activeWsId: string | null = null;

function lsKey(wsId: string) { return `buzzup.demand_points.${wsId}`; }

/** Normaliza: inteiros de 1 a 99, sem repetidos, ordenados, no máximo 6. */
export function normalizeDemandPoints(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [...DEFAULT_DEMAND_POINTS];
  const clean = Array.from(
    new Set(
      raw
        .map(v => Math.round(Number(v)))
        .filter(v => Number.isFinite(v) && v >= 1)
        .map(v => Math.min(v, MAX_DEMAND_POINT)),
    ),
  ).sort((a, b) => a - b);
  if (clean.length === 0) return [...DEFAULT_DEMAND_POINTS];
  return clean.slice(0, MAX_DEMAND_POINT_OPTIONS);
}

export function loadDemandPointsForWorkspace(wsId: string | null): void {
  _activeWsId = wsId;
  if (!wsId || cache.has(wsId)) return;
  try {
    const raw = sessionStorage.getItem(lsKey(wsId));
    cache.set(wsId, raw ? normalizeDemandPoints(JSON.parse(raw)) : [...DEFAULT_DEMAND_POINTS]);
  } catch {
    cache.set(wsId, [...DEFAULT_DEMAND_POINTS]);
  }
}

export function setDemandPointsCache(points: unknown, wsId?: string): number[] {
  const id = wsId || _activeWsId;
  const clean = normalizeDemandPoints(points);
  if (!id) return clean;
  cache.set(id, clean);
  try { sessionStorage.setItem(lsKey(id), JSON.stringify(clean)); } catch { /* storage bloqueado */ }
  return clean;
}

export function getDemandPoints(wsId?: string): number[] {
  const id = wsId || _activeWsId;
  if (!id) return [...DEFAULT_DEMAND_POINTS];
  return cache.get(id) ?? [...DEFAULT_DEMAND_POINTS];
}

/** Garante que um valor salvo continue válido mesmo se a configuração mudar. */
export function clampDemandPoints(value: number | null | undefined): number {
  const n = Math.round(Number(value ?? 1));
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(n, 1), MAX_DEMAND_POINT);
}
