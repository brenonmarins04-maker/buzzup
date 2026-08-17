import { describe, expect, it } from "vitest";
import { fromPreset, mondayOf, toLocalStr } from "@/components/reports/ReportFilter";

describe("períodos do relatório", () => {
  it("7 dias termina hoje e começa 7 dias antes", () => {
    const { start, end } = fromPreset("7d");
    const dias = Math.round(
      (new Date(end + "T00:00:00").getTime() - new Date(start + "T00:00:00").getTime()) / 86400000,
    );
    expect(dias).toBe(7);
  });

  it("períodos maiores cobrem janelas maiores", () => {
    const d7 = fromPreset("7d").start;
    const d30 = fromPreset("30d").start;
    const m3 = fromPreset("3m").start;
    expect(d30 < d7).toBe(true);
    expect(m3 < d30).toBe(true);
  });
});

describe("semana (Seg–Dom)", () => {
  it("segunda-feira é o início da própria semana", () => {
    const seg = new Date("2026-07-06T10:00:00"); // segunda
    expect(toLocalStr(mondayOf(seg))).toBe("2026-07-06");
  });

  it("domingo pertence à semana que começou na segunda anterior", () => {
    const dom = new Date("2026-07-12T23:00:00"); // domingo
    expect(toLocalStr(mondayOf(dom))).toBe("2026-07-06");
  });

  it("quarta cai na mesma semana da segunda", () => {
    const qua = new Date("2026-07-08T15:30:00");
    expect(toLocalStr(mondayOf(qua))).toBe("2026-07-06");
  });

  it("não desloca a data por causa de fuso", () => {
    const seg = new Date("2026-01-05T00:30:00");
    expect(toLocalStr(mondayOf(seg))).toBe("2026-01-05");
  });
});
