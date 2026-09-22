import { describe, expect, it } from "vitest";
import {
  cutoffArquivo,
  filtroDemandasAtivas,
  MESES_NA_MAO,
  precisaBuscarArquivo,
} from "@/lib/demandArchive";

const hoje = new Date("2026-09-22T12:00:00.000Z");

describe("corte do arquivo", () => {
  it("são dois meses para trás", () => {
    expect(MESES_NA_MAO).toBe(2);
    expect(cutoffArquivo(hoje).slice(0, 10)).toBe("2026-07-22");
  });

  it("atravessa a virada do ano sem se perder", () => {
    const janeiro = new Date("2026-01-15T12:00:00.000Z");
    expect(cutoffArquivo(janeiro).slice(0, 7)).toBe("2025-11");
  });

  it("aceita outro tamanho de janela", () => {
    expect(cutoffArquivo(hoje, 6).slice(0, 7)).toBe("2026-03");
  });
});

describe("filtro do carregamento do dia a dia", () => {
  const filtro = filtroDemandasAtivas(hoje);

  it("traz tudo que não está concluído", () => {
    expect(filtro).toContain("status.neq.done");
  });

  it("traz o que foi concluído há pouco", () => {
    expect(filtro).toContain(`completed_at.gte.${cutoffArquivo(hoje)}`);
  });

  it("mantém concluída sem data de conclusão", () => {
    // Sem esse campo não dá para saber se é antiga; esconder algo recente
    // seria pior que carregar a mais
    expect(filtro).toContain("completed_at.is.null");
  });

  it("as três condições são alternativas, não exigências", () => {
    expect(filtro.split(",")).toHaveLength(3);
  });
});

describe("quando os relatórios alcançam o arquivo", () => {
  it("janela recente não alcança", () => {
    expect(precisaBuscarArquivo(new Date("2026-09-01T00:00:00.000Z"), hoje)).toBe(false);
  });

  it("janela antiga alcança", () => {
    expect(precisaBuscarArquivo(new Date("2026-01-01T00:00:00.000Z"), hoje)).toBe(true);
  });

  it("sem início definido, considera que alcança", () => {
    expect(precisaBuscarArquivo(null, hoje)).toBe(true);
  });

  it("exatamente no corte não alcança", () => {
    expect(precisaBuscarArquivo(new Date(cutoffArquivo(hoje)), hoje)).toBe(false);
  });
});
