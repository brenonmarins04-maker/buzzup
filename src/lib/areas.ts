export type AreaKey = "projetos" | "mercado" | "gg" | "presidencia";

export const AREAS: { key: AreaKey; label: string; path: string; color: string }[] = [
  { key: "projetos",    label: "Projetos",    path: "/projetos",    color: "#3B7DD8" },
  { key: "mercado",     label: "Mercado",     path: "/mercado",     color: "#E8804A" },
  { key: "gg",          label: "GG",          path: "/gg",          color: "#2E9E6E" },
  { key: "presidencia", label: "Presidência", path: "/presidencia", color: "#9B59B6" },
];

export const AREA_OPTIONS = AREAS.map(a => ({ value: a.key, label: a.label }));

export const getAreaLabel = (key?: string | null) =>
  AREAS.find(a => a.key === key)?.label ?? "";