import { describe, expect, it } from "vitest";
import {
  DEFAULT_DEMAND_POINTS,
  MAX_DEMAND_POINT_OPTIONS,
  clampDemandPoints,
  normalizeDemandPoints,
} from "@/lib/demandPoints";

describe("normalizeDemandPoints", () => {
  it("mantém uma lista válida ordenada", () => {
    expect(normalizeDemandPoints([5, 10, 20])).toEqual([5, 10, 20]);
  });

  it("ordena e remove repetidos", () => {
    expect(normalizeDemandPoints([3, 1, 3, 2])).toEqual([1, 2, 3]);
  });

  it("cai no padrão quando vem vazio ou inválido", () => {
    expect(normalizeDemandPoints([])).toEqual(DEFAULT_DEMAND_POINTS);
    expect(normalizeDemandPoints(null)).toEqual(DEFAULT_DEMAND_POINTS);
    expect(normalizeDemandPoints("1,2,3")).toEqual(DEFAULT_DEMAND_POINTS);
    expect(normalizeDemandPoints([0, -4])).toEqual(DEFAULT_DEMAND_POINTS);
  });

  it("arredonda, descarta zero/negativo e limita a 99", () => {
    expect(normalizeDemandPoints([2.4, 0, -1, 150])).toEqual([2, 99]);
  });

  it("limita a quantidade de opções", () => {
    const muitas = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(normalizeDemandPoints(muitas)).toHaveLength(MAX_DEMAND_POINT_OPTIONS);
  });

  it("aceita valores acima de 3 (o antigo teto fixo)", () => {
    expect(normalizeDemandPoints([10, 25, 50])).toEqual([10, 25, 50]);
  });
});

describe("clampDemandPoints", () => {
  it("mantém valores válidos, inclusive acima de 3", () => {
    expect(clampDemandPoints(1)).toBe(1);
    expect(clampDemandPoints(25)).toBe(25);
  });

  it("protege contra vazio, zero e exagero", () => {
    expect(clampDemandPoints(undefined)).toBe(1);
    expect(clampDemandPoints(null)).toBe(1);
    expect(clampDemandPoints(0)).toBe(1);
    expect(clampDemandPoints(500)).toBe(99);
  });
});
