import { describe, expect, it } from "vitest";
import { buildCobrancaMessage, buildMensagemGeral } from "@/components/cobranca/CobrancaTab";
import type { ParkingItem } from "@/contexts/DataContext";

const demanda = (over: Partial<ParkingItem>): ParkingItem => ({
  id: "d1", area: "mercado", personId: "p1", title: "Demanda", description: "",
  date: "2026-08-20", position: 0, status: "in-progress", points: 1, ...over,
});

describe("mensagem de cobrança", () => {
  it("usa o primeiro nome da pessoa e o escopo", () => {
    const msg = buildCobrancaMessage("Breno Marins Nicoletti", [demanda({})], "Marketing");
    expect(msg).toContain("Oi, Breno!");
    expect(msg).toContain("demandas de Marketing");
  });

  it("mostra o prazo de cada demanda como 'até DD/MM'", () => {
    const msg = buildCobrancaMessage("Ana", [
      demanda({ id: "a", title: "Post de recrutamento", date: "2026-08-20" }),
    ], "Marketing");
    expect(msg).toContain("• Post de recrutamento — até 20/08");
  });

  it("demanda sem prazo aparece como 'data indefinida'", () => {
    const msg = buildCobrancaMessage("Ana", [
      demanda({ id: "b", title: "Planilha de vendas", date: "" }),
    ], "Marketing");
    expect(msg).toContain("• Planilha de vendas — data indefinida");
    expect(msg).not.toContain("até ");
  });

  it("lista várias demandas, cada uma em uma linha", () => {
    const msg = buildCobrancaMessage("Ana", [
      demanda({ id: "a", title: "Post", date: "2026-08-20" }),
      demanda({ id: "b", title: "Relatório", date: "" }),
    ], "Marketing");
    const linhas = msg.split("\n").filter(l => l.startsWith("•"));
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toContain("Post — até 20/08");
    expect(linhas[1]).toContain("Relatório — data indefinida");
  });

  it("aceita data com hora sem quebrar o formato", () => {
    const msg = buildCobrancaMessage("Ana", [
      demanda({ id: "c", title: "Reunião", date: "2026-08-20T15:00:00Z" }),
    ], "Vendas");
    expect(msg).toContain("Reunião — até 20/08");
  });

  it("é texto simples, pronto para colar", () => {
    const msg = buildCobrancaMessage("Ana", [demanda({})], "Marketing");
    expect(msg).not.toMatch(/<[a-z]/i); // sem HTML
    expect(typeof msg).toBe("string");
  });
});

describe("mensagem geral", () => {
  const pessoa = (id: string, name: string) => ({ id, name } as any);

  it("abre com a saudação do grupo e o escopo", () => {
    const msg = buildMensagemGeral([
      { person: pessoa("p1", "Breno Marins"), demands: [demanda({})] },
    ], "Marketing");
    expect(msg).toContain("Fala pessoal, tudo bem?");
    expect(msg).toContain("demandas da semana de Marketing");
  });

  it("lista nome - demanda - data", () => {
    const msg = buildMensagemGeral([
      { person: pessoa("p1", "Breno Marins"), demands: [demanda({ title: "Post", date: "2026-08-20" })] },
    ], "Marketing");
    expect(msg).toContain("• Breno - Post - até 20/08");
  });

  it("usa 'data indefinida' quando não há prazo", () => {
    const msg = buildMensagemGeral([
      { person: pessoa("p1", "Ana Souza"), demands: [demanda({ title: "Relatório", date: "" })] },
    ], "Vendas");
    expect(msg).toContain("• Ana - Relatório - data indefinida");
  });

  it("junta as demandas de todas as pessoas", () => {
    const msg = buildMensagemGeral([
      { person: pessoa("p1", "Breno"), demands: [demanda({ id: "a", title: "Post", date: "2026-08-20" })] },
      { person: pessoa("p2", "Ana"), demands: [
        demanda({ id: "b", title: "Planilha", date: "" }),
        demanda({ id: "c", title: "Reunião", date: "2026-08-21" }),
      ] },
    ], "Marketing");
    const linhas = msg.split("\n").filter(l => l.startsWith("•"));
    expect(linhas).toHaveLength(3);
    expect(linhas[0]).toContain("Breno - Post");
    expect(linhas[1]).toContain("Ana - Planilha - data indefinida");
    expect(linhas[2]).toContain("Ana - Reunião - até 21/08");
  });
});
