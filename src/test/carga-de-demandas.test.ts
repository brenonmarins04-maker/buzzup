import { describe, expect, it } from "vitest";
import { contarDemandasAbertas, recomendarMenosCarregados } from "@/lib/cargaDeDemandas";

const demanda = (personId: string | null, status = "in-progress") => ({ personId, status });

describe("carga de demandas", () => {
  it("conta as demandas de qualquer área, não só a que está aberta", () => {
    // O caso do relato: Luísa tem 3 no time de Diversidade e nenhuma no
    // Mercado. Ao distribuir no Mercado, ela NÃO está livre.
    const carga = contarDemandasAbertas([
      demanda("luisa"), demanda("luisa"), demanda("luisa"),
      demanda("pedro"),
    ]);

    expect(carga.get("luisa")).toBe(3);
    expect(carga.get("pedro")).toBe(1);
  });

  it("concluída não conta — senão quem entrega mais recebe menos", () => {
    const carga = contarDemandasAbertas([
      demanda("luisa", "done"), demanda("luisa", "done"), demanda("luisa"),
    ]);

    expect(carga.get("luisa")).toBe(1);
  });

  it("demanda sem responsável não entra na conta de ninguém", () => {
    const carga = contarDemandasAbertas([demanda(null), demanda(null)]);
    expect(carga.size).toBe(0);
  });

  it("as demandas do formato antigo também ocupam a pessoa", () => {
    const carga = contarDemandasAbertas(
      [demanda("luisa")],
      [
        { responsible: [{ id: "luisa" }, { id: "pedro" }], status: "in-progress" },
        { responsible: [{ id: "pedro" }], status: "done" },
      ],
    );

    expect(carga.get("luisa")).toBe(2);
    expect(carga.get("pedro")).toBe(1);
  });
});

describe("quem é o recomendado", () => {
  const pessoas = [{ id: "luisa" }, { id: "pedro" }, { id: "ana" }];

  it("recomenda quem tem menos, contando as outras áreas", () => {
    const carga = new Map([["luisa", 3], ["pedro", 1], ["ana", 5]]);
    expect(recomendarMenosCarregados(pessoas, carga)).toEqual(new Set(["pedro"]));
  });

  it("quem não aparece na conta está com zero e é o mais livre", () => {
    const carga = new Map([["luisa", 3], ["ana", 5]]);
    expect(recomendarMenosCarregados(pessoas, carga)).toEqual(new Set(["pedro"]));
  });

  it("empate no mínimo recomenda os dois — são igualmente os mais livres", () => {
    const carga = new Map([["luisa", 1], ["pedro", 1], ["ana", 4]]);
    expect(recomendarMenosCarregados(pessoas, carga)).toEqual(new Set(["luisa", "pedro"]));
  });

  it("todo mundo igual não recomenda ninguém — não há diferença a mostrar", () => {
    const carga = new Map([["luisa", 2], ["pedro", 2], ["ana", 2]]);
    expect(recomendarMenosCarregados(pessoas, carga).size).toBe(0);
  });

  it("ninguém com demanda nenhuma também é empate", () => {
    expect(recomendarMenosCarregados(pessoas, new Map()).size).toBe(0);
  });

  it("uma pessoa só não é recomendação, é a única opção", () => {
    expect(recomendarMenosCarregados([{ id: "luisa" }], new Map()).size).toBe(0);
  });
});
