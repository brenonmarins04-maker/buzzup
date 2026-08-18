import { describe, expect, it } from "vitest";
import {
  DEFAULT_FOOTER,
  DEFAULT_HEADER_GERAL,
  composeMessage,
  demandLine,
  prazoLabel,
} from "@/components/cobranca/CobrancaTab";

const opts = (showName: boolean, showDate: boolean) => ({ showName, showDate });

describe("prazo da demanda", () => {
  it("com data vira 'até DD/MM'", () => {
    expect(prazoLabel("2026-08-20")).toBe("até 20/08");
  });

  it("sem data vira 'data indefinida'", () => {
    expect(prazoLabel("")).toBe("data indefinida");
    expect(prazoLabel(null)).toBe("data indefinida");
  });

  it("aceita data com hora", () => {
    expect(prazoLabel("2026-08-20T15:00:00Z")).toBe("até 20/08");
  });
});

describe("linha da demanda — personalização por nome e data", () => {
  it("com nome e data: nome - demanda - data", () => {
    expect(demandLine("Post", "2026-08-20", "Breno Marins", opts(true, true)))
      .toBe("• Breno - Post - até 20/08");
  });

  it("sem nome: só demanda - data", () => {
    expect(demandLine("Post", "2026-08-20", "Breno Marins", opts(false, true)))
      .toBe("• Post - até 20/08");
  });

  it("sem data: só nome - demanda", () => {
    expect(demandLine("Post", "2026-08-20", "Breno Marins", opts(true, false)))
      .toBe("• Breno - Post");
  });

  it("sem nome e sem data: só a demanda", () => {
    expect(demandLine("Post", "2026-08-20", "Breno Marins", opts(false, false)))
      .toBe("• Post");
  });

  it("demanda sem prazo mostra 'data indefinida' quando a data está ligada", () => {
    expect(demandLine("Planilha", "", "Ana Souza", opts(true, true)))
      .toBe("• Ana - Planilha - data indefinida");
  });

  it("usa apenas o primeiro nome", () => {
    expect(demandLine("Post", "", "Breno Marins Nicoletti", opts(true, false)))
      .toBe("• Breno - Post");
  });
});

describe("montagem da mensagem", () => {
  const linhas = ["• Breno - Post - até 20/08", "• Ana - Planilha - data indefinida"];

  it("junta primeira linha, corpo e última linha", () => {
    const msg = composeMessage(DEFAULT_HEADER_GERAL, linhas, DEFAULT_FOOTER);
    expect(msg).toBe(
      `${DEFAULT_HEADER_GERAL}\n\n${linhas.join("\n")}\n\n${DEFAULT_FOOTER}`,
    );
  });

  it("preserva o texto que o diretor escreveu", () => {
    const msg = composeMessage("Bom dia, time!", linhas, "Abraço!");
    expect(msg.startsWith("Bom dia, time!")).toBe(true);
    expect(msg.endsWith("Abraço!")).toBe(true);
  });

  it("o corpo depende só das demandas, não do texto editado", () => {
    const a = composeMessage("Cabeçalho A", linhas, "Rodapé A");
    const b = composeMessage("Cabeçalho B", linhas, "Rodapé B");
    const corpo = (m: string) => m.split("\n").filter(l => l.startsWith("•")).join("\n");
    expect(corpo(a)).toBe(corpo(b));
  });

  it("omite bloco vazio quando não há primeira ou última linha", () => {
    expect(composeMessage("", linhas, "")).toBe(linhas.join("\n"));
  });

  it("é texto simples, pronto para colar", () => {
    const msg = composeMessage(DEFAULT_HEADER_GERAL, linhas, DEFAULT_FOOTER);
    expect(msg).not.toMatch(/<[a-z]/i);
  });
});
