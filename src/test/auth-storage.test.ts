// @vitest-environment node
import { describe, expect, it } from "vitest";
import { armazenamentoDaSessao } from "@/lib/authStorage";

const CHAVE = "sb-usebuzzup-auth-token";

/** Um Storage de mentira, com as manhas que os navegadores de celular têm. */
function falso(opcoes: { escritaFalha?: boolean; inicial?: Record<string, string> } = {}) {
  const dados = new Map(Object.entries(opcoes.inicial ?? {}));
  return {
    dados,
    storage: {
      getItem: (c: string) => dados.get(c) ?? null,
      setItem: (c: string, v: string) => {
        if (opcoes.escritaFalha) throw new DOMException("QuotaExceededError");
        dados.set(c, v);
      },
      removeItem: (c: string) => { dados.delete(c); },
      clear: () => dados.clear(),
      key: () => null,
      length: 0,
    } as Storage,
  };
}

const lanca = () => { throw new DOMException("SecurityError"); };

describe("onde a sessão fica guardada", () => {
  it("prefere o permanente — é o que faz a pessoa continuar logada no celular", () => {
    const permanente = falso();
    const daAba = falso();
    const guarda = armazenamentoDaSessao(CHAVE, () => permanente.storage, () => daAba.storage);

    guarda.setItem(CHAVE, "token");

    expect(permanente.dados.get(CHAVE)).toBe("token");
    expect(daAba.dados.has(CHAVE)).toBe(false);
  });

  it("leva junto quem já estava logado na aba", () => {
    const permanente = falso();
    const daAba = falso({ inicial: { [CHAVE]: "sessao-antiga" } });

    const guarda = armazenamentoDaSessao(CHAVE, () => permanente.storage, () => daAba.storage);

    expect(guarda.getItem(CHAVE)).toBe("sessao-antiga");
    expect(permanente.dados.get(CHAVE)).toBe("sessao-antiga");
  });

  it("não sobrescreve uma sessão mais nova com a da aba", () => {
    const permanente = falso({ inicial: { [CHAVE]: "sessao-nova" } });
    const daAba = falso({ inicial: { [CHAVE]: "sessao-antiga" } });

    const guarda = armazenamentoDaSessao(CHAVE, () => permanente.storage, () => daAba.storage);

    expect(guarda.getItem(CHAVE)).toBe("sessao-nova");
  });

  // O caso que derrubava o app inteiro: só tocar no armazenamento já lançava.
  it("navegador que bloqueia armazenamento não derruba nada", () => {
    const guarda = armazenamentoDaSessao(CHAVE, lanca, lanca);

    expect(() => guarda.setItem(CHAVE, "token")).not.toThrow();
    expect(guarda.getItem(CHAVE)).toBe("token");
    guarda.removeItem(CHAVE);
    expect(guarda.getItem(CHAVE)).toBeNull();
  });

  it("sem o permanente, cai para o da aba em vez de perder tudo", () => {
    const daAba = falso();
    const guarda = armazenamentoDaSessao(CHAVE, lanca, () => daAba.storage);

    guarda.setItem(CHAVE, "token");

    expect(daAba.dados.get(CHAVE)).toBe("token");
  });

  it("armazenamento que existe mas recusa escrita conta como indisponível", () => {
    const permanente = falso({ escritaFalha: true });
    const daAba = falso();

    const guarda = armazenamentoDaSessao(CHAVE, () => permanente.storage, () => daAba.storage);
    guarda.setItem(CHAVE, "token");

    expect(daAba.dados.get(CHAVE)).toBe("token");
  });

  it("sair apaga de verdade", () => {
    const permanente = falso({ inicial: { [CHAVE]: "token" } });
    const guarda = armazenamentoDaSessao(CHAVE, () => permanente.storage, () => undefined);

    guarda.removeItem(CHAVE);

    expect(permanente.dados.has(CHAVE)).toBe(false);
    expect(guarda.getItem(CHAVE)).toBeNull();
  });
});
