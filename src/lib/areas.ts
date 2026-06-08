export type AreaKey = "projetos" | "mercado" | "gg" | "presidencia";

export const AREAS_DEFAULT: { key: AreaKey; label: string; path: string; color: string }[] = [
  { key: "projetos",    label: "Geral",             path: "/projetos",    color: "#2563EB" },
  { key: "mercado",     label: "Marketing",          path: "/mercado",     color: "#F97316" },
  { key: "gg",          label: "Financeiro",         path: "/gg",          color: "#10B981" },
  { key: "presidencia", label: "Eventos / Projetos", path: "/presidencia", color: "#8B5CF6" },
];

// Custom area names stored in localStorage, synced via broadcasts
const AREA_NAMES_KEY = "buzzup.area_names";

let customNames: Record<string, string> = {};
try {
  const raw = localStorage.getItem(AREA_NAMES_KEY);
  if (raw) customNames = JSON.parse(raw);
} catch {}

export function setCustomAreaNames(names: Record<string, string>) {
  customNames = names;
  try { localStorage.setItem(AREA_NAMES_KEY, JSON.stringify(names)); } catch {}
}

export function getCustomAreaNames(): Record<string, string> {
  return { ...customNames };
}

export const AREAS: { key: AreaKey; label: string; path: string; color: string }[] = AREAS_DEFAULT.map(a => ({
  ...a,
  get label() { return customNames[a.key] || a.label; },
}));

export const AREA_OPTIONS = AREAS_DEFAULT.map(a => ({
  value: a.key,
  get label() { return customNames[a.key] || a.label; },
}));

export const getAreaLabel = (key?: string | null) => {
  if (!key) return "";
  if (customNames[key]) return customNames[key];
  return AREAS_DEFAULT.find(a => a.key === key)?.label ?? "";
};

// Distinct team color palette — avoids similar colors to the 4 areas
// (which use #2563EB blue, #F97316 orange, #10B981 emerald, #8B5CF6 purple)
const TEAM_PALETTE = [
  "#DB2777", // pink
  "#0891B2", // cyan
  "#CA8A04", // amber/yellow
  "#DC2626", // red
  "#65A30D", // lime
  "#0D9488", // teal
  "#BE185D", // rose
  "#B45309", // amber-dark
  "#075985", // sky-dark
  "#7C2D12", // brown
  "#166534", // green-dark
  "#1E3A8A", // navy
  "#6B21A8", // purple-dark
  "#9D174D", // pink-dark
  "#4D7C0F", // olive
  "#831843", // magenta-dark
];

// Get a distinct color for a team based on its id (stable hash → palette index)
export function getTeamColor(teamId: string): string {
  let hash = 0;
  for (let i = 0; i < teamId.length; i++) {
    hash = ((hash << 5) - hash) + teamId.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % TEAM_PALETTE.length;
  return TEAM_PALETTE[idx];
}

// Resolve color from any area key (real area or team_<id>)
export function getAreaColor(areaKey?: string | null): string {
  if (!areaKey) return "#CBD5E1";
  if (areaKey.startsWith("team_")) {
    return getTeamColor(areaKey.slice(5));
  }
  return AREAS_DEFAULT.find(a => a.key === areaKey)?.color ?? "#CBD5E1";
}
