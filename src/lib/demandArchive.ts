// Demandas concluídas antigas saem do que o app carrega no dia a dia.
//
// Elas continuam no banco — nada é apagado. O que muda é que o app deixa de
// baixá-las a cada abertura: uma entidade com um ano de uso acumula milhares
// de demandas concluídas que ninguém olha, e todas vinham juntas.

/** Quantos meses de demandas concluídas o app mantém à mão. */
export const MESES_NA_MAO = 2;

/**
 * Data de corte: concluída antes disso, sai do carregamento do dia a dia.
 * Recebe "hoje" para o cálculo poder ser testado.
 */
export function cutoffArquivo(hoje: Date = new Date(), meses = MESES_NA_MAO): string {
  const d = new Date(hoje.getTime());
  d.setMonth(d.getMonth() - meses);
  return d.toISOString();
}

/**
 * Filtro para o PostgREST.
 *
 * Traz o que está em andamento e o que foi concluído há pouco. Demanda
 * concluída sem data de conclusão também fica: sem esse campo não dá para
 * saber se é antiga, e esconder algo recente seria pior que carregar a mais.
 */
export function filtroDemandasAtivas(hoje: Date = new Date(), meses = MESES_NA_MAO): string {
  return `status.neq.done,completed_at.is.null,completed_at.gte.${cutoffArquivo(hoje, meses)}`;
}

/** A janela pedida alcança demandas que o app não carregou? */
export function precisaBuscarArquivo(
  inicioDaJanela: Date | null,
  hoje: Date = new Date(),
  meses = MESES_NA_MAO,
): boolean {
  if (!inicioDaJanela) return true; // "desde o início" sempre alcança
  return inicioDaJanela.toISOString() < cutoffArquivo(hoje, meses);
}
