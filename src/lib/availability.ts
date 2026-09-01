// Disponibilidade semanal e busca de horário em comum.
// Tudo aqui é aritmética de intervalos em minutos desde a meia-noite.

import type { Person, Team } from "@/contexts/DataContext";
import {
  resolveParticipants,
  SLOT_MIN,
  type Meeting,
} from "@/lib/agenda";

export type Interval = { startMin: number; endMin: number };

export type AvailabilitySlot = {
  id: string;
  userId: string;
  weekday: number;
  startMin: number;
  endMin: number;
};

// --- Aritmética de intervalos -----------------------------------------------

/**
 * Junta intervalos que se sobrepõem ou se encostam.
 * 09:00–10:00 e 10:00–11:00 viram 09:00–11:00: para quem lê a agenda é um
 * bloco livre só.
 */
export function mergeIntervals(list: Interval[]): Interval[] {
  const ordenados = [...list]
    .filter(i => i.endMin > i.startMin)
    .sort((a, b) => a.startMin - b.startMin);

  const out: Interval[] = [];
  for (const it of ordenados) {
    const ultimo = out[out.length - 1];
    if (ultimo && it.startMin <= ultimo.endMin) {
      ultimo.endMin = Math.max(ultimo.endMin, it.endMin);
    } else {
      out.push({ ...it });
    }
  }
  return out;
}

/** O que as duas listas têm em comum. Ambas devem vir já unificadas. */
export function intersectIntervals(a: Interval[], b: Interval[]): Interval[] {
  const out: Interval[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const startMin = Math.max(a[i].startMin, b[j].startMin);
    const endMin = Math.min(a[i].endMin, b[j].endMin);
    if (endMin > startMin) out.push({ startMin, endMin });
    // Avança quem termina primeiro
    if (a[i].endMin < b[j].endMin) i++;
    else j++;
  }
  return out;
}

/** Tira de `base` tudo o que estiver em `remover`. */
export function subtractIntervals(base: Interval[], remover: Interval[]): Interval[] {
  const cortes = mergeIntervals(remover);
  let atual = mergeIntervals(base);

  for (const c of cortes) {
    const proximo: Interval[] = [];
    for (const it of atual) {
      // Sem sobreposição: passa inteiro
      if (c.endMin <= it.startMin || c.startMin >= it.endMin) {
        proximo.push(it);
        continue;
      }
      if (c.startMin > it.startMin) proximo.push({ startMin: it.startMin, endMin: c.startMin });
      if (c.endMin < it.endMin) proximo.push({ startMin: c.endMin, endMin: it.endMin });
    }
    atual = proximo;
  }
  return atual;
}

/** Recorta a lista para caber dentro da janela informada. */
export function clampIntervals(list: Interval[], limite: Interval): Interval[] {
  return list
    .map(it => ({
      startMin: Math.max(it.startMin, limite.startMin),
      endMin: Math.min(it.endMin, limite.endMin),
    }))
    .filter(it => it.endMin > it.startMin);
}

// --- Disponibilidade --------------------------------------------------------

/** Blocos livres de uma conta num dia, já unificados. */
export function availabilityOf(
  slots: AvailabilitySlot[],
  userId: string,
  weekday: number,
): Interval[] {
  return mergeIntervals(
    slots
      .filter(s => s.userId === userId && s.weekday === weekday)
      .map(s => ({ startMin: s.startMin, endMin: s.endMin })),
  );
}

/** A conta já marcou alguma disponibilidade nesta semana? */
export function hasDeclaredAvailability(slots: AvailabilitySlot[], userId: string): boolean {
  return slots.some(s => s.userId === userId);
}

/** Reuniões de um dia que ocupam a pessoa. */
export function busyOf(
  meetings: Meeting[],
  personId: string,
  weekday: number,
  ctx: { people: Person[]; teams: Team[] },
): Interval[] {
  return mergeIntervals(
    meetings
      .filter(m => m.weekday === weekday && resolveParticipants(m, ctx).includes(personId))
      .map(m => ({ startMin: m.startMin, endMin: m.endMin })),
  );
}

// --- Busca de horário em comum ----------------------------------------------

export type CommonWindow = { weekday: number; startMin: number; endMin: number };

export type FindTimeInput = {
  /** Pessoas que precisam estar na reunião */
  personIds: string[];
  people: Person[];
  teams: Team[];
  meetings: Meeting[];
  availability: AvailabilitySlot[];
  /** Janela do dia considerada (ex.: 08:00 às 18:00) */
  limite: Interval;
  /** Duração mínima da janela devolvida */
  minDuration: number;
  /** Dias da semana a considerar */
  weekdays: number[];
};

/**
 * Janelas em que TODO mundo da lista está livre.
 *
 * Quem ainda não marcou disponibilidade entra como livre na janela inteira —
 * excluir essa pessoa faria a busca não devolver nada e parecer quebrada. Use
 * `peopleWithoutAvailability` para avisar quem foi tratado assim.
 */
export function findCommonWindows(input: FindTimeInput): CommonWindow[] {
  const { personIds, people, teams, meetings, availability, limite, minDuration, weekdays } = input;
  if (personIds.length === 0) return [];

  const ctx = { people, teams };
  const out: CommonWindow[] = [];

  for (const weekday of weekdays) {
    let comum: Interval[] | null = null;

    for (const personId of personIds) {
      const pessoa = people.find(p => p.id === personId);
      const userId = pessoa?.userId ?? null;

      const declarou = !!userId && hasDeclaredAvailability(availability, userId);
      const livre = declarou
        ? clampIntervals(availabilityOf(availability, userId!, weekday), limite)
        : [{ ...limite }];

      const semReuniao = subtractIntervals(livre, busyOf(meetings, personId, weekday, ctx));

      comum = comum === null ? semReuniao : intersectIntervals(comum, semReuniao);
      if (comum.length === 0) break; // ninguém mais salva este dia
    }

    for (const it of comum ?? []) {
      if (it.endMin - it.startMin >= minDuration) {
        out.push({ weekday, startMin: it.startMin, endMin: it.endMin });
      }
    }
  }

  return out;
}

/** Quem da lista ainda não marcou disponibilidade nenhuma. */
export function peopleWithoutAvailability(
  personIds: string[],
  people: Person[],
  availability: AvailabilitySlot[],
): Person[] {
  return personIds
    .map(id => people.find(p => p.id === id))
    .filter((p): p is Person => {
      if (!p) return false;
      return !p.userId || !hasDeclaredAvailability(availability, p.userId);
    });
}

/** Opções de duração para a busca. */
export const DURATION_OPTIONS = [
  { value: SLOT_MIN, label: "30 min" },
  { value: 60, label: "1 hora" },
  { value: 90, label: "1h30" },
  { value: 120, label: "2 horas" },
];
