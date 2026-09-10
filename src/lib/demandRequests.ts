// Demandas que o próprio membro propõe para si.
// Ficam na fila até um líder ou diretor aceitar; só então viram demanda.

import { AREAS, getAreaLabel } from "@/lib/areas";
import type { Team } from "@/contexts/DataContext";

export type DemandRequestStatus = "pending" | "accepted" | "rejected";

export type DemandRequest = {
  id: string;
  /** Chave da área ("mercado") ou do time ("team_<uuid>") */
  area: string;
  title: string;
  points: number;
  /** Prazo é opcional: "" quando não tem */
  date: string;
  personId: string;
  requestedBy: string;
  status: DemandRequestStatus;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
};

/** Um destino possível para a demanda: uma área ou um time. */
export type DemandScope = {
  key: string;
  label: string;
  color: string;
  kind: "area" | "team";
  /** Só nos times: quem faz parte. Áreas usam Person.areas. */
  memberIds?: string[];
};

export const TEAM_PREFIX = "team_";

export function isTeamScope(key: string): boolean {
  return key.startsWith(TEAM_PREFIX);
}

/** Cores dos times: a chave não carrega cor, então usamos uma paleta fixa. */
const TEAM_COLORS = ["#00B4D8", "#F97316", "#10B981", "#8B5CF6", "#EC4899", "#EAB308"];

/**
 * Áreas primeiro, times depois — as áreas são a divisão principal da entidade
 * e é onde a maioria das demandas cai.
 */
export function buildScopes(teams: Team[]): DemandScope[] {
  const areas: DemandScope[] = AREAS.map(a => ({
    key: a.key,
    label: getAreaLabel(a.key),
    color: a.color,
    kind: "area" as const,
  }));

  const times: DemandScope[] = teams.map((t, i) => ({
    key: `${TEAM_PREFIX}${t.id}`,
    label: t.name,
    color: TEAM_COLORS[i % TEAM_COLORS.length],
    kind: "team" as const,
    memberIds: t.memberIds,
  }));

  return [...areas, ...times];
}

/** Nome legível de um destino, para mostrar na fila dos diretores. */
export function scopeLabel(key: string, teams: Team[]): string {
  if (isTeamScope(key)) {
    const id = key.slice(TEAM_PREFIX.length);
    return teams.find(t => t.id === id)?.name ?? "Time";
  }
  return getAreaLabel(key);
}

// --- Passos do formulário ----------------------------------------------------

export const WIZARD_STEPS = ["escopo", "demanda", "prazo"] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

export type DemandDraft = {
  area: string | null;
  title: string;
  points: number;
  /** "" = sem prazo */
  date: string;
};

export const EMPTY_DRAFT: DemandDraft = { area: null, title: "", points: 1, date: "" };

/** Pontos oferecidos como atalho. Cobrem de tarefa rápida a entrega grande. */
export const SUGGESTED_POINTS = [1, 2, 3, 5, 8];

/** O passo está completo o bastante para avançar? */
export function canAdvance(step: WizardStep, draft: DemandDraft): boolean {
  if (step === "escopo") return !!draft.area;
  if (step === "demanda") return draft.title.trim().length > 0 && draft.points >= 0;
  return true; // prazo é opcional
}

export function nextStep(step: WizardStep): WizardStep | null {
  const i = WIZARD_STEPS.indexOf(step);
  return i >= 0 && i < WIZARD_STEPS.length - 1 ? WIZARD_STEPS[i + 1] : null;
}

export function prevStep(step: WizardStep): WizardStep | null {
  const i = WIZARD_STEPS.indexOf(step);
  return i > 0 ? WIZARD_STEPS[i - 1] : null;
}

/** O rascunho está pronto para virar pedido? */
export function isDraftComplete(draft: DemandDraft): boolean {
  return canAdvance("escopo", draft) && canAdvance("demanda", draft);
}

/** Limita os pontos ao que o banco aceita. */
export function clampPoints(raw: number): number {
  if (!Number.isFinite(raw)) return 1;
  return Math.min(99, Math.max(0, Math.round(raw)));
}

// --- Fila --------------------------------------------------------------------

/** Pedidos ainda sem decisão, do mais antigo para o mais novo. */
export function pendingRequests(list: DemandRequest[]): DemandRequest[] {
  return list
    .filter(r => r.status === "pending")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** "20/08" — prazo curto para o card; vazio quando não tem. */
export function shortDate(iso: string): string {
  if (!iso) return "";
  const [, m, d] = iso.split("-");
  return m && d ? `${d}/${m}` : "";
}

/**
 * Separa os destinos entre os que a pessoa participa e o resto.
 *
 * As áreas e times de quem está enviando vêm primeiro e visíveis; os outros
 * ficam atrás de um toque. Na prática a demanda quase sempre é do próprio
 * grupo, e mostrar a lista inteira faz procurar onde não precisa.
 */
export function splitScopesForPerson(
  scopes: DemandScope[],
  eu: { personId: string | null; areas: string[] },
): { meus: DemandScope[]; outros: DemandScope[] } {
  const minhasAreas = new Set(eu.areas);
  const meus: DemandScope[] = [];
  const outros: DemandScope[] = [];

  for (const s of scopes) {
    const meu = s.kind === "area"
      ? minhasAreas.has(s.key)
      : !!eu.personId && (s.memberIds ?? []).includes(eu.personId);
    (meu ? meus : outros).push(s);
  }

  return { meus, outros };
}
