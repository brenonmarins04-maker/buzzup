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
 * O <body> está bloqueado sem nada aberto que justifique?
 * É a assinatura exata do bloqueio esquecido.
 */
export function cliquesTravados(doc: Document): boolean {
  if (doc.body?.style?.pointerEvents !== "none") return false;
  return !temMenuAberto(doc);
}

/**
 * Destrava, se for o caso. Devolve true quando precisou agir — útil para
 * testar e para não mexer no documento à toa.
 */
export function destravarCliques(doc: Document): boolean {
  if (!cliquesTravados(doc)) return false;
  doc.body.style.removeProperty("pointer-events");
  return true;
}
