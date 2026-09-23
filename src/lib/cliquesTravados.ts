// Destrava a página quando um menu suspenso some sem se despedir.
//
// Diálogos e popovers põem `pointer-events: none` no <body> enquanto estão
// abertos, e tiram ao fechar. Se o componente desmonta ANTES de fechar — o que
// acontece ao trocar de tela com um deles aberto — essa limpeza nunca roda e
// a página inteira para de responder a cliques.

/** Marcas que um menu suspenso realmente aberto deixa no documento. */
const ABERTOS = [
  '[role="dialog"][data-state="open"]',
  '[role="alertdialog"][data-state="open"]',
  "[data-radix-popper-content-wrapper]",
].join(", ");

/** Há algum menu suspenso de fato aberto agora? */
export function temMenuAberto(doc: Document): boolean {
  return doc.querySelectorAll(ABERTOS).length > 0;
}

/**
 * Atributo que a trava de rolagem deixa no <body>. É o segundo mecanismo:
 * o Radix bloqueia o clique por estilo inline, e a trava de rolagem bloqueia
 * a rolagem por este atributo. Sobrando qualquer um dos dois, a página fica
 * inutilizável.
 */
const ATRIBUTO_ROLAGEM = "data-scroll-locked";

/**
 * O <body> está bloqueado sem nada aberto que justifique?
 * É a assinatura exata do bloqueio esquecido.
 */
export function cliquesTravados(doc: Document): boolean {
  const body = doc.body;
  if (!body) return false;
  const bloqueado =
    body.style?.pointerEvents === "none" || body.hasAttribute(ATRIBUTO_ROLAGEM);
  if (!bloqueado) return false;
  return !temMenuAberto(doc);
}

/**
 * Destrava, se for o caso. Devolve true quando precisou agir — útil para
 * testar e para não mexer no documento à toa.
 */
export function destravarCliques(doc: Document): boolean {
  if (!cliquesTravados(doc)) return false;
  doc.body.style.removeProperty("pointer-events");
  doc.body.removeAttribute(ATRIBUTO_ROLAGEM);
  return true;
}
