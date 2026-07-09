import { describe, it, expect } from "vitest";
import { isDemandOverdue, normalizeToISODate, formatDemandDayMonth } from "@/lib/demandStatus";

const TODAY = "2026-07-09";

describe("normalizeToISODate", () => {
  it("mantém ISO", () => expect(normalizeToISODate("2026-07-11")).toBe("2026-07-11"));
  it("corta a hora do timestamp", () => expect(normalizeToISODate("2026-07-11T03:00:00+00:00")).toBe("2026-07-11"));
  it("converte DD/MM/YYYY", () => expect(normalizeToISODate("11/07/2026")).toBe("2026-07-11"));
  it("vazio vira null", () => expect(normalizeToISODate("")).toBeNull());
});

describe("isDemandOverdue", () => {
  it("demanda futura (11/07) NÃO está atrasada hoje (09/07)", () => {
    expect(isDemandOverdue({ status: "in-progress", date: "2026-07-11" }, TODAY)).toBe(false);
  });
  it("mesmo em DD/MM/YYYY, 11/07 NÃO está atrasada", () => {
    expect(isDemandOverdue({ status: "in-progress", date: "11/07/2026" }, TODAY)).toBe(false);
  });
  it("demanda passada (07/07) está atrasada", () => {
    expect(isDemandOverdue({ status: "in-progress", date: "2026-07-07" }, TODAY)).toBe(true);
  });
  it("demanda de hoje NÃO está atrasada", () => {
    expect(isDemandOverdue({ status: "in-progress", date: TODAY }, TODAY)).toBe(false);
  });
  it("concluída nunca está atrasada", () => {
    expect(isDemandOverdue({ status: "done", date: "2026-07-01" }, TODAY)).toBe(false);
  });
  it("sem data nunca está atrasada", () => {
    expect(isDemandOverdue({ status: "in-progress", date: "" }, TODAY)).toBe(false);
  });
});

describe("formatDemandDayMonth", () => {
  it("ISO vira DD/MM", () => expect(formatDemandDayMonth("2026-07-11")).toBe("11/07"));
  it("DD/MM/YYYY vira DD/MM (sem Invalid Date)", () => expect(formatDemandDayMonth("11/07/2026")).toBe("11/07"));
  it("vazio vira null", () => expect(formatDemandDayMonth("")).toBeNull());
});
