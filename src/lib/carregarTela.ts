// Carregamento dos arquivos de cada tela (code splitting).

/** Marca que já recarregamos por causa disso, para não entrar em laço. */
const CHAVE = "buzzup.recarregou-por-tela-faltando";

type Recarregar = () => void;
type Memoria = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * Envolve o import de uma tela.
 *
 * Depois de um deploy, uma aba que já estava aberta pede os arquivos da
 * versão antiga — que não existem mais. Sem tratamento a tela fica carregando
 * para sempre, porque a promessa do import nunca vira nada útil.
 *
 * Aqui a página recarrega uma vez e pega a versão nova. Uma vez só: se falhar
 * de novo o problema é outro, e aí o erro sobe para quem sabe mostrá-lo em
 * vez de ficar recarregando sem parar.
 */
export function carregarTela<T>(
  importar: () => Promise<T>,
  deps: { recarregar?: Recarregar; memoria?: Memoria } = {},
): Promise<T> {
  const recarregar = deps.recarregar
    ?? (() => { if (typeof window !== "undefined") window.location.reload(); });
  const memoria = deps.memoria
    ?? (typeof sessionStorage !== "undefined" ? sessionStorage : undefined);

  return importar().then(
    modulo => {
      // Deu certo: libera uma futura recarga, para o próximo deploy
      try { memoria?.removeItem(CHAVE); } catch { /* modo privado */ }
      return modulo;
    },
    erro => {
      let jaTentou = false;
      try { jaTentou = memoria?.getItem(CHAVE) === "1"; } catch { jaTentou = false; }

      if (jaTentou) throw erro;

      try { memoria?.setItem(CHAVE, "1"); } catch { /* modo privado */ }
      recarregar();

      // A página está indo embora: esta promessa não precisa terminar, e
      // resolvê-la com qualquer coisa faria a tela piscar conteúdo errado
      return new Promise<T>(() => {});
    },
  );
}
