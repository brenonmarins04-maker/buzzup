// Apelidos da gamificação: agrupamento por área e seleção para reset.

export type NickPerson = {
  id: string;
  name: string;
  nickname?: string | null;
  area?: string | null;
  areas?: string[] | null;
};

export type AreaOption = { key: string; label: string; color: string };

export type AreaGroup = AreaOption & {
  /** Todo mundo da área */
  people: NickPerson[];
  /** Quem já tem apelido */
  comApelido: NickPerson[];
  /** Quem ainda não tem */
  semApelido: NickPerson[];
};

/** Chave usada pelo grupo de quem não está em área nenhuma. */
export const SEM_AREA = "__none__";

/** Filtro "todas as áreas" no reset em massa. */
export const TODAS_AS_AREAS = "__all__";

export function hasNickname(p: NickPerson): boolean {
  return !!p.nickname && p.nickname.trim().length > 0;
}

/** Áreas da pessoa, tolerando o formato antigo (string separada por vírgula). */
export function areasOf(p: NickPerson): string[] {
  if (p.areas && p.areas.length > 0) return p.areas;
  if (p.area && p.area.trim()) return p.area.split(",").map(a => a.trim()).filter(Boolean);
  return [];
}

/**
 * Agrupa as pessoas por área, separando quem tem e quem não tem apelido.
 * Quem está em duas áreas aparece nas duas. Áreas sem ninguém saem da lista.
 */
export function groupPeopleByArea(people: NickPerson[], areas: AreaOption[]): AreaGroup[] {
  const out: AreaGroup[] = [];

  for (const area of areas) {
    const daArea = people.filter(p => areasOf(p).includes(area.key));
    if (daArea.length === 0) continue;
    out.push({
      ...area,
      people: daArea,
      comApelido: daArea.filter(hasNickname),
      semApelido: daArea.filter(p => !hasNickname(p)),
    });
  }

  const semArea = people.filter(p => areasOf(p).length === 0);
  if (semArea.length > 0) {
    out.push({
      key: SEM_AREA,
      label: "Sem área",
      color: "#94A3B8",
      people: semArea,
      comApelido: semArea.filter(hasNickname),
      semApelido: semArea.filter(p => !hasNickname(p)),
    });
  }

  return out;
}

/**
 * Quem seria afetado por um reset. Só entra quem TEM apelido: limpar o de
 * quem já está sem não muda nada e inflaria a contagem mostrada na confirmação.
 */
export function peopleForReset(people: NickPerson[], areaKey: string): NickPerson[] {
  const comApelido = people.filter(hasNickname);
  if (areaKey === TODAS_AS_AREAS) return comApelido;
  if (areaKey === SEM_AREA) return comApelido.filter(p => areasOf(p).length === 0);
  return comApelido.filter(p => areasOf(p).includes(areaKey));
}

/** "3 de 8" — resumo do preenchimento de uma área. */
export function progressOf(group: AreaGroup): { filled: number; total: number; pct: number } {
  const total = group.people.length;
  const filled = group.comApelido.length;
  return { filled, total, pct: total === 0 ? 0 : (filled / total) * 100 };
}
