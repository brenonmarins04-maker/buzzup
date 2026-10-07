// Onde a sessão de login fica guardada.
//
// Duas falhas vinham daqui, e as duas só apareciam no celular:
//
// 1) `sessionStorage` morre com a aba. No computador isso não aparece — a aba
//    fica aberta por dias e a pessoa segue logada. No celular aparece sempre:
//    o sistema descarta abas em segundo plano, link de WhatsApp e Instagram
//    abre num navegador interno com armazenamento próprio, e cada reabertura
//    começa do zero. Daí "estou logado no computador e não consigo no celular".
//
// 2) Ler `sessionStorage` derruba o app inteiro quando o navegador bloqueia
//    armazenamento (aba anônima, cookies de terceiros desligados, WebView
//    restrita): o acesso LANÇA em vez de devolver undefined, e como isso era
//    feito no topo do módulo, nem a tela de login chegava a aparecer.
//
// Aqui a escolha é: armazenamento permanente > armazenamento da aba > memória.
// Nenhum caminho lança, e quem já estava logado na aba é levado junto.

/** O pedaço de Storage que o SDK do Supabase realmente usa. */
export type Armazem = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const PROVA = "buzzup.prova-de-armazenamento";

/** Só serve o armazém em que dá para escrever de verdade, agora. */
function utilizavel(abrir: () => Storage | null | undefined): Storage | null {
  try {
    const alvo = abrir();
    if (!alvo) return null;
    // Em modo privado antigo do Safari o objeto existe e `setItem` estoura.
    alvo.setItem(PROVA, "1");
    alvo.removeItem(PROVA);
    return alvo;
  } catch {
    return null;
  }
}

/** Último recurso: a sessão vale enquanto a página estiver aberta. */
function naMemoria(): Armazem {
  const dados = new Map<string, string>();
  return {
    getItem: chave => dados.get(chave) ?? null,
    setItem: (chave, valor) => { dados.set(chave, valor); },
    removeItem: chave => { dados.delete(chave); },
  };
}

/**
 * Guarda da sessão, com a chave que o SDK usa.
 *
 * As duas fábricas são injetáveis só para teste; em produção saem do próprio
 * navegador. Elas são funções, e não valores, porque o simples acesso a
 * `localStorage` pode lançar.
 */
export function armazenamentoDaSessao(
  chave: string,
  abrirPermanente: () => Storage | null | undefined = () => globalThis.localStorage,
  abrirDaAba: () => Storage | null | undefined = () => globalThis.sessionStorage,
): Armazem {
  const permanente = utilizavel(abrirPermanente);
  const daAba = utilizavel(abrirDaAba);
  const escolhido = permanente ?? daAba;
  if (!escolhido) return naMemoria();

  // Quem já estava logado tem a sessão presa à aba. Copiar antes de usar evita
  // que a correção, justamente ela, derrube todo mundo para a tela de login.
  if (permanente && daAba) {
    try {
      const anterior = daAba.getItem(chave);
      if (anterior !== null && permanente.getItem(chave) === null) {
        permanente.setItem(chave, anterior);
      }
    } catch {
      // A migração é cortesia: sem ela a pessoa só precisa entrar de novo.
    }
  }

  return {
    getItem: c => { try { return escolhido.getItem(c); } catch { return null; } },
    setItem: (c, v) => {
      try { escolhido.setItem(c, v); } catch { /* cota cheia: segue na aba */ }
    },
    removeItem: c => {
      try { escolhido.removeItem(c); } catch { /* nada a fazer */ }
    },
  };
}
