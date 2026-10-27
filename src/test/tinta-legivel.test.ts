import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { contraste, etiquetaDaCor, fundoParaTextoBranco, tintaLegivel } from "@/lib/tintaLegivel";

/** As cores reais do produto — é com elas que a conta tem de fechar. */
const AREAS = {
  Geral: "#00B4D8",
  Marketing: "#F97316",
  Financeiro: "#10B981",
  "Eventos / Projetos": "#8B5CF6",
};

describe("conta de contraste", () => {
  it("bate com os extremos conhecidos", () => {
    expect(contraste("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contraste("#ffffff", "#ffffff")).toBeCloseTo(1, 2);
  });

  it("aceita hex curto e rgb, não só hex de seis", () => {
    expect(contraste("#000", "#fff")).toBeCloseTo(21, 1);
    expect(contraste("rgb(0, 0, 0)", "#ffffff")).toBeCloseTo(21, 1);
  });
});

describe("tinta legível", () => {
  it("as cores das áreas, como texto, não passavam — era esse o defeito", () => {
    // Prova do problema: todas abaixo de 4,5:1 sobre branco.
    Object.values(AREAS).forEach(cor => {
      expect(contraste(cor, "#ffffff")).toBeLessThan(4.5);
    });
  });

  it("depois de escurecidas, todas passam", () => {
    Object.values(AREAS).forEach(cor => {
      expect(contraste(tintaLegivel(cor), "#ffffff")).toBeGreaterThanOrEqual(4.5);
    });
  });

  it("não mexe no que já passa", () => {
    const escura = "#14532d";
    expect(tintaLegivel(escura)).toBe(escura);
  });

  it("escurece, nunca clareia", () => {
    Object.values(AREAS).forEach(cor => {
      expect(contraste(tintaLegivel(cor), "#ffffff")).toBeGreaterThan(contraste(cor, "#ffffff"));
    });
  });

  it("mantém a matiz: laranja continua laranja", () => {
    // O canal vermelho segue sendo o maior no laranja, e o azul o menor.
    const tinta = tintaLegivel(AREAS.Marketing).replace("#", "");
    const [r, g, b] = [0, 2, 4].map(i => parseInt(tinta.slice(i, i + 2), 16));
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
  });
});

describe("etiqueta pronta", () => {
  it("o texto é medido contra o fundo pálido de verdade, e passa", () => {
    Object.values(AREAS).forEach(cor => {
      const { fundo, texto } = etiquetaDaCor(cor);
      expect(contraste(texto, fundo)).toBeGreaterThanOrEqual(4.5);
    });
  });

  it("o fundo pálido continua claro — é etiqueta, não bloco de cor", () => {
    Object.values(AREAS).forEach(cor => {
      const { fundo } = etiquetaDaCor(cor);
      expect(contraste(fundo, "#ffffff")).toBeLessThan(1.3);
    });
  });
});

describe("preenchimento com texto branco", () => {
  it("o branco em cima passa a ser legível", () => {
    Object.values(AREAS).forEach(cor => {
      expect(contraste("#ffffff", fundoParaTextoBranco(cor))).toBeGreaterThanOrEqual(4.5);
    });
  });
});

describe("os tokens do tema, lidos do index.css", () => {
  // Trava de regressão: se alguém clarear o ciano de novo, este teste cai
  // antes de a tela ilegível chegar no ar.
  const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf-8");

  const token = (nome: string) => {
    const padrao = new RegExp(String.raw`(?:^|[^-\w])--${nome}:\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%`, "m");
    const m = css.match(padrao);
    if (!m) throw new Error(`token --${nome} não encontrado`);
    return hslParaHex(Number(m[1]), Number(m[2]), Number(m[3]));
  };

  it("branco sobre o primário é legível", () => {
    expect(contraste("#ffffff", token("primary"))).toBeGreaterThanOrEqual(4.5);
  });

  it("o primário como texto sobre o fundo claro também é legível", () => {
    expect(contraste(token("primary"), token("background"))).toBeGreaterThanOrEqual(4.5);
  });

  it("o cinza secundário passa sobre o chão e sobre o card", () => {
    expect(contraste(token("muted-foreground"), token("background"))).toBeGreaterThanOrEqual(4.5);
    expect(contraste(token("muted-foreground"), "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });

  it("a tinta principal passa com folga", () => {
    expect(contraste(token("foreground"), token("background"))).toBeGreaterThanOrEqual(7);
  });

  it("branco sobre o vermelho de erro é legível", () => {
    expect(contraste("#ffffff", token("destructive"))).toBeGreaterThanOrEqual(4.5);
  });
});

function hslParaHex(h: number, s: number, l: number): string {
  const S = s / 100, L = l / 100;
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = L - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const dois = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${dois(r)}${dois(g)}${dois(b)}`;
}
