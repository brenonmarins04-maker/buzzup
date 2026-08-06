// Chave de área: as 4 padrão do workspace + as criadas pelo owner (prefixo area_)
export type AreaKey = string;

export const DEFAULT_AREA_KEYS = ["projetos", "mercado", "gg", "presidencia"] as const;

/** Áreas criadas pelo usuário usam este prefixo para se distinguir das padrão. */
export const CUSTOM_AREA_PREFIX = "area_";

export function isCustomAreaKey(key?: string | null): boolean {
  return !!key && key.startsWith(CUSTOM_AREA_PREFIX);
}

export function makeCustomAreaKey(): string {
  return `${CUSTOM_AREA_PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export const AREAS_DEFAULT: { key: AreaKey; label: string; path: string; color: string }[] = [
  { key: "projetos",    label: "Geral",             path: "/projetos",    color: "#00B4D8" },
  { key: "mercado",     label: "Marketing",          path: "/mercado",     color: "#F97316" },
  { key: "gg",          label: "Financeiro",         path: "/gg",          color: "#10B981" },
  { key: "presidencia", label: "Eventos / Projetos", path: "/presidencia", color: "#8B5CF6" },
];

// ─── Per-workspace area names ────────────────────────────────────────────────
// In-memory cache: workspaceId → custom name map
const wsNamesCache = new Map<string, Record<string, string>>();
let _activeWsId: string | null = null;

function lsKey(wsId: string) { return `buzzup.area_names.${wsId}`; }

/** Called whenever the active workspace changes (by AuthContext / AppLayout). */
export function loadAreaNamesForWorkspace(wsId: string | null): void {
  _activeWsId = wsId;
  if (!wsId) { syncAreas(); return; }
  if (wsNamesCache.has(wsId)) { syncAreas(); return; } // already loaded
  try {
    const raw = sessionStorage.getItem(lsKey(wsId));
    wsNamesCache.set(wsId, raw ? JSON.parse(raw) : {});
  } catch {
    wsNamesCache.set(wsId, {});
  }
  syncAreas();
}

/** Persist custom names for a specific workspace (and update in-memory cache). */
export function setCustomAreaNames(names: Record<string, string>, wsId?: string): void {
  const id = wsId || _activeWsId;
  if (!id) return;
  wsNamesCache.set(id, names);
  try { sessionStorage.setItem(lsKey(id), JSON.stringify(names)); } catch {}
  syncAreas();
}

/** Read custom names for a workspace (defaults to active workspace). */
export function getCustomAreaNames(wsId?: string): Record<string, string> {
  const id = wsId || _activeWsId;
  if (!id) return {};
  return wsNamesCache.get(id) ?? {};
}

/** Resolve the display label for an area key in the active workspace. */
export const getAreaLabel = (key?: string | null): string => {
  if (!key) return "";
  const custom = getCustomAreaNames();
  if (custom[key]) return custom[key];
  if (isCustomAreaKey(key)) return "Nova área"; // criada mas ainda sem nome
  return AREAS_DEFAULT.find(a => a.key === key)?.label ?? "";
};

/** Áreas criadas pelo owner: qualquer chave com prefixo custom no mapa de nomes. */
export function getCustomAreas(wsId?: string): { key: AreaKey; label: string; path: string; color: string }[] {
  const names = getCustomAreaNames(wsId);
  return Object.keys(names)
    .filter(isCustomAreaKey)
    .map(key => ({
      key,
      label: names[key] || "Nova área",
      path: `/${key}`,
      color: getTeamColor(key), // cor estável derivada da chave
    }));
}

// AREAS é mutado no lugar (mesma referência) para que os imports existentes
// continuem válidos quando o workspace troca ou uma área é criada/removida.
// O label usa getter para resolver o nome do workspace ativo no render.
export const AREAS: { key: AreaKey; label: string; path: string; color: string }[] = [];
export const AREA_OPTIONS: { value: AreaKey; label: string }[] = [];

function syncAreas(): void {
  const defaults = AREAS_DEFAULT.map(a => ({
    ...a,
    get label() { return getAreaLabel(a.key); },
  }));
  const next = [...defaults, ...getCustomAreas()];
  AREAS.length = 0;
  AREAS.push(...next);
  AREA_OPTIONS.length = 0;
  AREA_OPTIONS.push(...next.map(a => ({ value: a.key, get label() { return getAreaLabel(a.key); } })));
}

syncAreas();

// ─── Team color palette ──────────────────────────────────────────────────────
const TEAM_PALETTE = [
  "#DB2777", "#0891B2", "#CA8A04", "#DC2626", "#65A30D",
  "#0D9488", "#BE185D", "#B45309", "#008EAD", "#7C2D12",
  "#166534", "#00B4D8", "#6B21A8", "#9D174D", "#4D7C0F",
  "#831843",
];

export function getTeamColor(teamId: string): string {
  let hash = 0;
  for (let i = 0; i < teamId.length; i++) {
    hash = ((hash << 5) - hash) + teamId.charCodeAt(i);
    hash |= 0;
  }
  return TEAM_PALETTE[Math.abs(hash) % TEAM_PALETTE.length];
}

export function getTeamIdFromAreaKey(areaKey?: string | null): string | null {
  if (!areaKey) return null;
  return /^team_/i.test(areaKey) ? areaKey.slice(5) : null;
}

export function isTeamAreaKey(areaKey?: string | null): boolean {
  return !!getTeamIdFromAreaKey(areaKey);
}

export function getAreaColor(areaKey?: string | null): string {
  if (!areaKey) return "#CBD5E1";
  const teamId = getTeamIdFromAreaKey(areaKey);
  if (teamId) return getTeamColor(teamId);
  if (isCustomAreaKey(areaKey)) return getTeamColor(areaKey);
  return AREAS_DEFAULT.find(a => a.key === areaKey)?.color ?? "#CBD5E1";
}
