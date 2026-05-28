export type AreaKey = "projetos" | "mercado" | "gg" | "presidencia";

export const AREAS: { key: AreaKey; label: string; path: string; color: string }[] = [
  { key: "projetos",    label: "Projetos",    path: "/projetos",    color: "#2563EB" },
  { key: "mercado",     label: "Mercado",     path: "/mercado",     color: "#F97316" },
  { key: "gg",          label: "GG",          path: "/gg",          color: "#10B981" },
  { key: "presidencia", label: "Presidência", path: "/presidencia", color: "#8B5CF6" },
];

export const AREA_OPTIONS = AREAS.map(a => ({ value: a.key, label: a.label }));

export const getAreaLabel = (key?: string | null) =>
  AREAS.find(a => a.key === key)?.label ?? "";