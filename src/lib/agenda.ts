// Agenda de reuniões semanais.
// Cada reunião tem um dia da semana e um intervalo de horário que se repete
// toda semana. Os horários andam de 30 em 30 minutos.

import type { Person, Team } from "@/contexts/DataContext";

/** Passo mínimo de horário, em minutos. */
export const SLOT_MIN = 30;

/** Faixa mostrada na grade quando não há reunião fora dela. */
export const DEFAULT_DAY_START = 7 * 60;  // 07:00
export const DEFAULT_DAY_END = 22 * 60;   // 22:00

/** 0 = domingo, como no JavaScript. A grade começa na segunda. */
export const WEEKDAYS: { key: number; short: string; label: string }[] = [
  { key: 1, short: "Seg", label: "Segunda" },
  { key: 2, short: "Ter", label: "Terça" },
  { key: 3, short: "Qua", label: "Quarta" },
  { key: 4, short: "Qui", label: "Quinta" },
  { key: 5, short: "Sex", label: "Sexta" },
  { key: 6, short: "Sáb", label: "Sábado" },
  { key: 0, short: "Dom", label: "Domingo" },
];

export const WEEKDAYS_UTEIS = WEEKDAYS.filter(d => d.key >= 1 && d.key <= 5);

export function weekdayLabel(key: number): string {
  return WEEKDAYS.find(d => d.key === key)?.label ?? "";
}

export type MeetingTargetType = "team" | "area" | "people";

export type MeetingRoom = {
  id: string;
  name: string;
  color: string;
  position: number;
};

export type Meeting = {
  id: string;
  title: string;
  description: string;
  roomId: string | null;
  weekday: number;
  startMin: number;
  endMin: number;
  targetType: MeetingTargetType;
  /** id do time ou chave da área */
  targetValue: string | null;
  /** pessoas escolhidas uma a uma (targetType = "people") */
  personIds: string[];
  createdBy: string | null;
  createdAt: string;
};

// --- Horários ---------------------------------------------------------------

/** 870 -> "14:30" */
export function minutesToLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "14:30" -> 870. Devolve null se não for um horário válido. */
export function labelToMinutes(label: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(label.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Opções de horário de 30 em 30 minutos, para os seletores. */
export function buildTimeOptions(from = 6 * 60, to = 23 * 60 + 30): { value: number; label: string }[] {
  const out: { value: number; label: string }[] = [];
  const first = Math.ceil(from / SLOT_MIN) * SLOT_MIN;
  for (let m = first; m <= to; m += SLOT_MIN) out.push({ value: m, label: minutesToLabel(m) });
  return out;
}

/** "1h30" / "45min" — duração legível. */
export function durationLabel(startMin: number, endMin: number): string {
  const total = Math.max(0, endMin - startMin);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h}h${String(m).padStart(2, "0")}`;
  if (h) return `${h}h`;
  return `${m}min`;
}

/** Dois intervalos se sobrepõem? Encostar não conta: 14–15 e 15–16 convivem. */
export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

// --- Participantes ----------------------------------------------------------

/** Pessoas de uma área, pela mesma regra usada no resto do app. */
export function peopleOfArea(people: Person[], areaKey: string): Person[] {
  return people.filter(p => (p.areas && p.areas.includes(areaKey)) || p.area === areaKey);
}

/**
 * Quem participa da reunião. Escolher um time ou uma área já inclui todas as
 * pessoas dele — não é preciso marcar uma a uma.
 */
export function resolveParticipants(
  meeting: Pick<Meeting, "targetType" | "targetValue" | "personIds">,
  ctx: { people: Person[]; teams: Team[] },
): string[] {
  if (meeting.targetType === "team") {
    const team = ctx.teams.find(t => t.id === meeting.targetValue);
    return team ? [...team.memberIds] : [];
  }
  if (meeting.targetType === "area") {
    return meeting.targetValue ? peopleOfArea(ctx.people, meeting.targetValue).map(p => p.id) : [];
  }
  return [...meeting.personIds];
}

/**
 * Nome da pessoa. Usa o nome de verdade, não o apelido da gamificação: na
 * agenda quem lê precisa saber de quem se trata.
 */
export function personName(people: Person[], id: string): string {
  const p = people.find(x => x.id === id);
  return p?.name || "alguém";
}

// --- Conflitos --------------------------------------------------------------

export type MeetingDraft = Pick<
  Meeting,
  "weekday" | "startMin" | "endMin" | "targetType" | "targetValue" | "personIds" | "roomId"
> & { id?: string };

export type Conflict =
  | { kind: "people"; meeting: Meeting; personIds: string[] }
  | { kind: "room"; meeting: Meeting; personIds: string[] };

/**
 * Reuniões que batem com o rascunho: mesma pessoa em dois lugares ao mesmo
 * tempo, ou a mesma sala ocupada. Só olha o mesmo dia da semana.
 */
export function findConflicts(
  draft: MeetingDraft,
  existing: Meeting[],
  ctx: { people: Person[]; teams: Team[] },
): Conflict[] {
  const mine = new Set(resolveParticipants(draft, ctx));
  const out: Conflict[] = [];

  for (const m of existing) {
    if (m.id === draft.id) continue; // editando ela mesma
    if (m.weekday !== draft.weekday) continue;
    if (!overlaps(draft.startMin, draft.endMin, m.startMin, m.endMin)) continue;

    const shared = resolveParticipants(m, ctx).filter(id => mine.has(id));
    if (shared.length) {
      out.push({ kind: "people", meeting: m, personIds: shared });
    } else if (draft.roomId && m.roomId === draft.roomId) {
      // Sala ocupada só vira aviso quando ninguém em comum já explicou o choque
      out.push({ kind: "room", meeting: m, personIds: [] });
    }
  }

  return out;
}

/** Frase pronta explicando o choque, para mostrar na hora de marcar. */
export function describeConflict(
  conflict: Conflict,
  ctx: { people: Person[]; rooms: MeetingRoom[] },
): string {
  const { meeting } = conflict;
  const quando = `${minutesToLabel(meeting.startMin)}–${minutesToLabel(meeting.endMin)}`;

  if (conflict.kind === "room") {
    const sala = ctx.rooms.find(r => r.id === meeting.roomId)?.name ?? "a sala";
    return `${sala} já está ocupada por "${meeting.title}" das ${quando}.`;
  }

  const nomes = conflict.personIds.map(id => personName(ctx.people, id));
  const lista = formatNameList(nomes);
  const verbo = nomes.length === 1 ? "tem" : "têm";
  return `${lista} ${verbo} "${meeting.title}" das ${quando}.`;
}

/** "Ana", "Ana e Bia", "Ana, Bia e mais 3" */
export function formatNameList(names: string[], max = 3): string {
  if (names.length === 0) return "Ninguém";
  if (names.length === 1) return names[0];
  if (names.length <= max) {
    return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
  }
  const extra = names.length - max;
  return `${names.slice(0, max).join(", ")} e mais ${extra}`;
}

// --- Grade ------------------------------------------------------------------

/** Faixa de horas que a grade precisa cobrir para caber todas as reuniões. */
export function gridRange(meetings: Meeting[]): { start: number; end: number } {
  let start = DEFAULT_DAY_START;
  let end = DEFAULT_DAY_END;
  for (const m of meetings) {
    if (m.startMin < start) start = Math.floor(m.startMin / 60) * 60;
    if (m.endMin > end) end = Math.ceil(m.endMin / 60) * 60;
  }
  return { start, end };
}

/**
 * Em que horário o ponteiro está, dada a distância até o topo da grade.
 * Arredonda para baixo até o slot de 30 min e nunca sai da faixa visível.
 */
export function slotAtOffset(
  offsetY: number,
  range: { start: number; end: number },
  pxPerHour: number,
): number {
  // Sem uma posição válida, fica no começo da faixa: devolver NaN faria o
  // arraste se achar "movido" sozinho, já que NaN nunca é igual a NaN.
  if (!Number.isFinite(offsetY)) return range.start;
  const bruto = range.start + (offsetY / pxPerHour) * 60;
  const slot = Math.floor(bruto / SLOT_MIN) * SLOT_MIN;
  return Math.min(Math.max(slot, range.start), range.end - SLOT_MIN);
}

/**
 * Intervalo de um arraste entre dois slots. Arrastar para cima funciona igual,
 * e soltar no mesmo slot em que começou vale meia hora.
 */
export function dragRange(anchor: number, current: number): { startMin: number; endMin: number } {
  return {
    startMin: Math.min(anchor, current),
    endMin: Math.max(anchor, current) + SLOT_MIN,
  };
}

/**
 * Reuniões que se sobrepõem no mesmo dia dividem a largura da coluna.
 * Devolve, para cada uma, em qual "faixa" ela entra e quantas faixas existem.
 */
export function layoutDay(dayMeetings: Meeting[]): Map<string, { lane: number; lanes: number }> {
  const sorted = [...dayMeetings].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const result = new Map<string, { lane: number; lanes: number }>();

  // Agrupa em blocos que se encavalam; dentro do bloco, distribui em faixas
  let group: Meeting[] = [];
  let groupEnd = -1;

  const flush = () => {
    if (!group.length) return;
    const laneEnds: number[] = [];
    const assign = new Map<string, number>();
    for (const m of group) {
      let lane = laneEnds.findIndex(end => end <= m.startMin);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(m.endMin); }
      else laneEnds[lane] = m.endMin;
      assign.set(m.id, lane);
    }
    for (const m of group) {
      result.set(m.id, { lane: assign.get(m.id) ?? 0, lanes: laneEnds.length });
    }
    group = [];
    groupEnd = -1;
  };

  for (const m of sorted) {
    if (group.length && m.startMin >= groupEnd) flush();
    group.push(m);
    groupEnd = Math.max(groupEnd, m.endMin);
  }
  flush();

  return result;
}
