import { describe, expect, it } from "vitest";
import {
  awardTimestampForCycle,
  pointsOutsideCycles,
  pointsPerCycle,
  type GamificationCycle,
} from "@/lib/gamificationCycles";
import { EMOJI_MAX_LEN, EMOJI_OPTIONS, normalizeEmoji } from "@/lib/gamificationEmoji";

const ciclo3: GamificationCycle = { id: "c3", name: "Ciclo 3", start: "2026-01-01", end: "2026-06-30" };
const ciclo4: GamificationCycle = { id: "c4", name: "Ciclo 4", start: "2026-08-19", end: "2026-12-31" };
const emAberto: GamificationCycle = { id: "c5", name: "Ciclo 5", start: "2027-01-01", end: "" };

const award = (points: number, awardedAt: string) => ({ points, awardedAt });

describe("data do ponto conforme o ciclo filtrado", () => {
  it("sem ciclo, deixa o banco carimbar a hora", () => {
    expect(awardTimestampForCycle(null, "2026-09-02T09:00:00.000Z")).toBeNull();
  });

  it("hoje dentro do ciclo também deixa o banco carimbar", () => {
    expect(awardTimestampForCycle(ciclo4, "2026-09-02T09:00:00.000Z")).toBeNull();
  });

  it("ciclo já encerrado recebe o ponto no último dia dele", () => {
    expect(awardTimestampForCycle(ciclo3, "2026-09-02T09:00:00.000Z"))
      .toBe("2026-06-30T12:00:00.000Z");
  });

  it("ciclo que ainda não começou recebe no primeiro dia", () => {
    expect(awardTimestampForCycle(emAberto, "2026-09-02T09:00:00.000Z"))
      .toBe("2027-01-01T12:00:00.000Z");
  });

  it("ciclo sem data final e já começado não força data", () => {
    expect(awardTimestampForCycle(emAberto, "2027-05-05T09:00:00.000Z")).toBeNull();
  });

  it("o primeiro e o último dia do ciclo contam como dentro", () => {
    expect(awardTimestampForCycle(ciclo4, "2026-08-19T00:00:00.000Z")).toBeNull();
    expect(awardTimestampForCycle(ciclo4, "2026-12-31T23:00:00.000Z")).toBeNull();
  });
});

describe("pontos divididos por ciclo", () => {
  const awards = [
    award(5, "2026-02-10T10:00:00.000Z"),  // ciclo 3
    award(3, "2026-06-30T18:00:00.000Z"),  // ciclo 3, último dia
    award(10, "2026-09-01T10:00:00.000Z"), // ciclo 4
    award(7, "2025-12-01T10:00:00.000Z"),  // antes de tudo
  ];

  it("soma o que caiu em cada ciclo", () => {
    const r = pointsPerCycle(awards, [ciclo4, ciclo3]);
    expect(r.map(x => [x.cycle.id, x.points])).toEqual([["c4", 10], ["c3", 8]]);
  });

  it("aponta o que ficou fora de todos os ciclos", () => {
    expect(pointsOutsideCycles(awards, [ciclo4, ciclo3])).toBe(7);
  });

  it("sem ciclo nenhum, nada fica 'fora'", () => {
    expect(pointsOutsideCycles(awards, [])).toBe(0);
    expect(pointsPerCycle(awards, [])).toEqual([]);
  });

  it("ciclo sem pontos aparece zerado, não some", () => {
    const r = pointsPerCycle([award(4, "2026-09-01T10:00:00.000Z")], [ciclo4, ciclo3]);
    expect(r.map(x => x.points)).toEqual([4, 0]);
  });

  it("ponto contado em dois ciclos que se sobrepõem entra nos dois", () => {
    const a: GamificationCycle = { id: "a", name: "A", start: "2026-01-01", end: "2026-12-31" };
    const b: GamificationCycle = { id: "b", name: "B", start: "2026-06-01", end: "2026-12-31" };
    const r = pointsPerCycle([award(2, "2026-07-01T10:00:00.000Z")], [a, b]);
    expect(r.map(x => x.points)).toEqual([2, 2]);
  });
});

describe("emoji do ranking", () => {
  it("a lista não tem repetidos", () => {
    expect(new Set(EMOJI_OPTIONS).size).toBe(EMOJI_OPTIONS.length);
  });

  it("todo emoji da lista cabe no limite do banco", () => {
    for (const e of EMOJI_OPTIONS) expect(e.length).toBeLessThanOrEqual(EMOJI_MAX_LEN);
  });

  it("aceita um emoji da lista", () => {
    expect(normalizeEmoji("🔥")).toBe("🔥");
  });

  it("vazio remove o emoji", () => {
    expect(normalizeEmoji("")).toBeNull();
    expect(normalizeEmoji("   ")).toBeNull();
    expect(normalizeEmoji(null)).toBeNull();
    expect(normalizeEmoji(undefined)).toBeNull();
  });

  it("recusa o que não está na lista", () => {
    expect(normalizeEmoji("texto qualquer")).toBeNull();
    expect(normalizeEmoji("🤬")).toBeNull();
  });

  it("recusa algo grande demais para o banco", () => {
    expect(normalizeEmoji("🔥🔥🔥🔥🔥")).toBeNull();
  });
});
