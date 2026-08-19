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

describe("filtro por ciclo", () => {
  // Espelha applyCycle: a janela do gráfico vira o período do ciclo.
  const janelaDoCiclo = (c: { start: string; end: string }, hoje: string) => ({
    start: c.start,
    end: c.end || hoje,
  });

  it("usa o início e o fim do ciclo como período", () => {
    expect(janelaDoCiclo({ start: "2026-08-01", end: "2026-08-31" }, "2026-09-10"))
      .toEqual({ start: "2026-08-01", end: "2026-08-31" });
  });

  it("ciclo em andamento (sem fim) vai até hoje", () => {
    expect(janelaDoCiclo({ start: "2026-08-19", end: "" }, "2026-09-10"))
      .toEqual({ start: "2026-08-19", end: "2026-09-10" });
  });

  it("não inclui o que veio antes do início do ciclo", () => {
    const { start } = janelaDoCiclo({ start: "2026-08-19", end: "" }, "2026-09-10");
    expect("2026-08-18" < start).toBe(true);  // fora
    expect("2026-08-19" < start).toBe(false); // dentro
  });
});
