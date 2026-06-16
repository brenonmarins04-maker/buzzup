import type { Person } from "@/contexts/DataContext";

/**
 * Conjunto de chaves que o usuário lidera neste workspace.
 * Cada chave é uma área (ex.: "mercado") ou um time (ex.: "team_<id>").
 * A liderança vem de Person.leaderAreas (persistida no banco em people.leader_areas,
 * com fallback para localStorage por compatibilidade).
 */
export function getLeaderKeys(people: Person[], userId: string | null | undefined): Set<string> {
  const keys = new Set<string>();
  if (!userId) return keys;
  for (const p of people) {
    if (p.userId !== userId) continue;
    const list = p.leaderAreas || (p.leaderArea ? [p.leaderArea] : []);
    for (const k of list) if (k) keys.add(k);
  }
  return keys;
}

/** O usuário lidera a área/time informado? */
export function leadsKey(people: Person[], userId: string | null | undefined, key: string): boolean {
  return getLeaderKeys(people, userId).has(key);
}

/** O usuário lidera ao menos uma área ou time? */
export function isLeaderOfAny(people: Person[], userId: string | null | undefined): boolean {
  return getLeaderKeys(people, userId).size > 0;
}
