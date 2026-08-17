import { describe, expect, it } from "vitest";
import {
  findActiveCycle,
  isInCycle,
  formatCycleRange,
  normalizeCycles,
  type GamificationCycle,
} from "@/lib/gamificationCycles";

const ciclo = (over: Partial<GamificationCycle> = {}): GamificationCycle => ({
  id: "c1", name: "Ciclo 1", start: "2026-07-01", end: "", ...over,
});

describe("isInCycle", () => {
  it("sem ciclo ativo, todo ponto conta", () => {
    expect(isInCycle("2020-01-01T10:00:00Z", null)).toBe(true);
  });

  it("ponto anterior ao início do ciclo não conta", () => {
    expect(isInCycle("2026-06-30T23:00:00Z", ciclo())).toBe(false);
  });

  it("ponto no dia do início conta", () => {
    expect(isInCycle("2026-07-01T08:00:00Z", ciclo())).toBe(true);
  });

  it("ciclo em andamento (sem fim) aceita datas futuras", () => {
    expect(isInCycle("2027-01-01T00:00:00Z", ciclo())).toBe(true);
  });

  it("com data final, ponto depois do fim não conta", () => {
    const c = ciclo({ end: "2026-07-31" });
    expect(isInCycle("2026-07-31T23:59:00Z", c)).toBe(true);
    expect(isInCycle("2026-08-01T00:01:00Z", c)).toBe(false);
  });

  it("data ausente não conta quando há ciclo", () => {
    expect(isInCycle(null, ciclo())).toBe(false);
  });
});

describe("normalizeCycles", () => {
  it("aceita payload vazio ou inválido", () => {
    expect(normalizeCycles(null)).toEqual({ cycles: [], activeId: null });
    expect(normalizeCycles({ cycles: "nada" })).toEqual({ cycles: [], activeId: null });
  });

  it("descarta ciclos sem id ou com data inválida", () => {
    const r = normalizeCycles({
      cycles: [
        { id: "a", name: "Ok", start: "2026-07-01" },
        { name: "Sem id", start: "2026-07-01" },
        { id: "c", name: "Data ruim", start: "julho" },
      ],
    });
    expect(r.cycles.map(c => c.id)).toEqual(["a"]);
  });

  it("ordena do mais recente para o mais antigo", () => {
    const r = normalizeCycles({
      cycles: [
        { id: "a", name: "Antigo", start: "2026-01-01" },
        { id: "b", name: "Novo", start: "2026-08-01" },
      ],
    });
    expect(r.cycles.map(c => c.id)).toEqual(["b", "a"]);
  });

  it("ignora activeId que não existe na lista", () => {
    const r = normalizeCycles({
      cycles: [{ id: "a", name: "Ok", start: "2026-07-01" }],
      activeId: "fantasma",
    });
    expect(r.activeId).toBeNull();
  });

  it("mantém activeId válido e o resolve", () => {
    const state = normalizeCycles({
      cycles: [{ id: "a", name: "Ciclo A", start: "2026-07-01" }],
      activeId: "a",
    });
    expect(state.activeId).toBe("a");
    expect(findActiveCycle(state)?.name).toBe("Ciclo A");
  });
});

describe("formatCycleRange", () => {
  it("ciclo aberto mostra apenas o início", () => {
    expect(formatCycleRange(ciclo())).toBe("desde 01/07/26");
  });

  it("ciclo fechado mostra o intervalo", () => {
    expect(formatCycleRange(ciclo({ end: "2026-07-31" }))).toBe("01/07/26 – 31/07/26");
  });
});
