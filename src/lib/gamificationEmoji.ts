// Emoji pessoal exibido no ranking da gamificação.

/**
 * Lista fechada de propósito: o emoji aparece no ranking de todo mundo, e um
 * campo livre deixaria colar texto ou algo ofensivo. O banco também limita o
 * tamanho, mas a lista é a primeira barreira.
 */
export const EMOJI_OPTIONS = [
  "🔥", "⚡", "🚀", "⭐", "💎", "🏆", "🎯", "💪",
  "🧠", "☕", "🍕", "🍩", "🐝", "🦊", "🐼", "🦄",
  "🌵", "🌊", "🌙", "☀️", "🎧", "🎨", "📚", "💻",
  "😎", "🤓", "🥳", "👑", "🍀", "🎲", "🛸", "🧃",
];

/** Tamanho máximo aceito pelo banco (set_my_emoji). */
export const EMOJI_MAX_LEN = 8;

/**
 * Normaliza o que veio da interface: vazio vira null (remove o emoji), e o que
 * não estiver na lista é recusado.
 */
export function normalizeEmoji(raw: string | null | undefined): string | null {
  const valor = (raw ?? "").trim();
  if (!valor) return null;
  if (valor.length > EMOJI_MAX_LEN) return null;
  return EMOJI_OPTIONS.includes(valor) ? valor : null;
}
