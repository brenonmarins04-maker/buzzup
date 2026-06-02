export type AreaKey = "projetos" | "mercado" | "gg" | "presidencia";

export const AREAS_DEFAULT: { key: AreaKey; label: string; path: string; color: string }[] = [
  { key: "projetos",    label: "Projetos",    path: "/projetos",    color: "#2563EB" },
  { key: "mercado",     label: "Mercado",     path: "/mercado",     color: "#F97316" },
  { key: "gg",          label: "GG",          path: "/gg",          color: "#10B981" },
  { key: "presidencia", label: "Presidência", path: "/presidencia", color: "#8B5CF6" },
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
