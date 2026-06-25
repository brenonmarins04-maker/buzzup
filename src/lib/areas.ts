export type AreaKey = "projetos" | "mercado" | "gg" | "presidencia";

export const AREAS_DEFAULT: { key: AreaKey; label: string; path: string; color: string }[] = [
  { key: "projetos",    label: "Geral",             path: "/projetos",    color: "#2563EB" },
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
  if (!wsId) return;
  if (wsNamesCache.has(wsId)) return; // already loaded
  try {
    const raw = sessionStorage.getItem(lsKey(wsId));
    wsNamesCache.set(wsId, raw ? JSON.parse(raw) : {});
  } catch {
    wsNamesCache.set(wsId, {});
  }
}

/** Persist custom names for a specific workspace (and update in-memory cache). */
export function setCustomAreaNames(names: Record<string, string>, wsId?: string): void {
  const id = wsId || _activeWsId;
  if (!id) return;
  wsNamesCache.set(id, names);
  try { sessionStorage.setItem(lsKey(id), JSON.stringify(names)); } catch {}
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
  return AREAS_DEFAULT.find(a => a.key === key)?.label ?? "";
};

// AREAS uses getter so label is always resolved from the active workspace at render time
export const AREAS: { key: AreaKey; label: string; path: string; color: string }[] =
  AREAS_DEFAULT.map(a => ({
    ...a,
    get label() { return getAreaLabel(a.key); },
  }));

export const AREA_OPTIONS = AREAS_DEFAULT.map(a => ({
  value: a.key,
  get label() { return getAreaLabel(a.key); },
}));

// ─── Team color palette ──────────────────────────────────────────────────────
const TEAM_PALETTE = [
  "#DB2777", "#0891B2", "#CA8A04", "#DC2626", "#65A30D",
  "#0D9488", "#BE185D", "#B45309", "#075985", "#7C2D12",
  "#166534", "#1E3A8A", "#6B21A8", "#9D174D", "#4D7C0F",
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

export function getAreaColor(areaKey?: string | null): string {
  if (!areaKey) return "#CBD5E1";
  if (areaKey.startsWith("team_")) return getTeamColor(areaKey.slice(5));
  return AREAS_DEFAULT.find(a => a.key === areaKey)?.color ?? "#CBD5E1";
}
