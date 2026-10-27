// Quantas demandas cada pessoa tem em aberto — no workspace inteiro.
//
// A conta é de propósito feita sobre TODAS as áreas e times, não só sobre a
// área onde a demanda está sendo criada. Alguém pode estar com três demandas
// no time de Diversidade e nenhuma no Mercado: na hora de distribuir trabalho
// no Mercado, essa pessoa não está livre, e olhar só para o Mercado diria que
// está.
//
// Concluídas não entram. A conta é de carga de trabalho, não de histórico —
// senão quem mais entrega vira quem menos recebe.

type DemandaDoQuadro = { personId: string | null; status?: string };
type DemandaAntiga = { responsible?: { id: string }[]; status?: string };

/** Quantas demandas em aberto cada pessoa tem, por id de pessoa. */
export function contarDemandasAbertas(
  demandas: DemandaDoQuadro[],
  demandasAntigas: DemandaAntiga[] = [],
): Map<string, number> {
  const porPessoa = new Map<string, number>();
  const somar = (id: string) => porPessoa.set(id, (porPessoa.get(id) ?? 0) + 1);

  demandas.forEach(d => {
    if (d.status === "done" || !d.personId) return;
    somar(d.personId);
  });

  // As "tasks" são o formato antigo de demanda; seguem no calendário e
  // seguem ocupando a pessoa, então contam igual.
  demandasAntigas.forEach(t => {
    if (t.status === "done") return;
    t.responsible?.forEach(p => somar(p.id));
  });

  return porPessoa;
}

/**
 * Quem está com menos demandas, entre os candidatos desta área ou time.
 *
 * Empate geral não recomenda ninguém: se todo mundo tem a mesma carga, apontar
 * um nome seria inventar uma diferença que não existe. Empate só no mínimo
 * recomenda todos os empatados — são de fato igualmente os mais livres.
 */
export function recomendarMenosCarregados(
  candidatos: { id: string }[],
  carga: Map<string, number>,
): Set<string> {
  if (candidatos.length < 2) return new Set();

  const contagens = candidatos.map(p => carga.get(p.id) ?? 0);
  const minimo = Math.min(...contagens);
  const maximo = Math.max(...contagens);
  if (minimo === maximo) return new Set();

  return new Set(
    candidatos.filter(p => (carga.get(p.id) ?? 0) === minimo).map(p => p.id),
  );
}
