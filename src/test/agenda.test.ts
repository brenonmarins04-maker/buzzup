import { describe, expect, it } from "vitest";
import {
  buildTimeOptions,
  describeConflict,
  durationLabel,
  findConflicts,
  formatNameList,
  gridRange,
  labelToMinutes,
  layoutDay,
  slotAtOffset,
  dragRange,
  minutesToLabel,
  overlaps,
  resolveParticipants,
  type Meeting,
} from "@/lib/agenda";
import type { Person, Team } from "@/contexts/DataContext";

const people: Person[] = [
  { id: "ana", name: "Ana Souza", nickname: "Ana", area: "mercado", areas: ["mercado"] },
  { id: "bia", name: "Bia Lima", area: "mercado", areas: ["mercado", "gg"] },
  { id: "caio", name: "Caio Reis", area: "gg", areas: ["gg"] },
  { id: "duda", name: "Duda Alves", area: null, areas: [] },
];

const teams: Team[] = [
  { id: "t1", name: "Time Alpha", memberIds: ["ana", "caio"] },
  { id: "t2", name: "Time Beta", memberIds: ["duda"] },
];

const ctx = { people, teams };

function meeting(over: Partial<Meeting> = {}): Meeting {
  return {
    id: "m1",
    title: "Reunião",
    description: "",
    roomId: null,
    weekday: 1,
    startMin: 14 * 60,
    endMin: 15 * 60,
    targetType: "people",
    targetValue: null,
    personIds: [],
    createdBy: null,
    createdAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("horários", () => {
  it("converte minutos em rótulo e de volta", () => {
    expect(minutesToLabel(870)).toBe("14:30");
    expect(minutesToLabel(0)).toBe("00:00");
    expect(minutesToLabel(9 * 60)).toBe("09:00");
    expect(labelToMinutes("14:30")).toBe(870);
    expect(labelToMinutes("9:00")).toBe(540);
    expect(labelToMinutes("banana")).toBeNull();
    expect(labelToMinutes("25:00")).toBeNull();
  });

  it("só oferece horários de 30 em 30 minutos", () => {
    const opts = buildTimeOptions(8 * 60, 10 * 60);
    expect(opts.map(o => o.label)).toEqual(["08:00", "08:30", "09:00", "09:30", "10:00"]);
    for (const o of opts) expect(o.value % 30).toBe(0);
  });

  it("descreve a duração", () => {
    expect(durationLabel(14 * 60, 15 * 60)).toBe("1h");
    expect(durationLabel(14 * 60, 15 * 60 + 30)).toBe("1h30");
    expect(durationLabel(14 * 60, 14 * 60 + 30)).toBe("30min");
  });

  it("horários que só encostam não se sobrepõem", () => {
    expect(overlaps(840, 900, 900, 960)).toBe(false); // 14–15 e 15–16
    expect(overlaps(840, 900, 870, 960)).toBe(true);  // 14–15 e 14:30–16
    expect(overlaps(840, 960, 870, 900)).toBe(true);  // uma dentro da outra
  });
});

describe("participantes", () => {
  it("escolher um time já inclui todo mundo dele", () => {
    const m = meeting({ targetType: "team", targetValue: "t1" });
    expect(resolveParticipants(m, ctx).sort()).toEqual(["ana", "caio"]);
  });

  it("escolher uma área já inclui todo mundo dela", () => {
    const m = meeting({ targetType: "area", targetValue: "mercado" });
    expect(resolveParticipants(m, ctx).sort()).toEqual(["ana", "bia"]);
  });

  it("pessoa em duas áreas entra nas duas", () => {
    const gg = meeting({ targetType: "area", targetValue: "gg" });
    expect(resolveParticipants(gg, ctx).sort()).toEqual(["bia", "caio"]);
  });

  it("pessoas avulsas usam a lista escolhida", () => {
    const m = meeting({ targetType: "people", personIds: ["duda", "ana"] });
    expect(resolveParticipants(m, ctx).sort()).toEqual(["ana", "duda"]);
  });

  it("time inexistente não quebra", () => {
    const m = meeting({ targetType: "team", targetValue: "sumiu" });
    expect(resolveParticipants(m, ctx)).toEqual([]);
  });
});

describe("conflitos de horário", () => {
  const existente = meeting({
    id: "existente",
    title: "Reunião de Marketing",
    weekday: 1,
    startMin: 14 * 60,
    endMin: 15 * 60,
    targetType: "area",
    targetValue: "mercado", // ana + bia
  });

  it("acusa quando alguém já tem reunião no horário", () => {
    const draft = meeting({ id: undefined, targetType: "people", personIds: ["ana"] });
    const cs = findConflicts(draft, [existente], ctx);
    expect(cs).toHaveLength(1);
    expect(cs[0].kind).toBe("people");
    expect(cs[0].personIds).toEqual(["ana"]);
  });

  it("acusa via time quando o time cai na área ocupada", () => {
    // Time Alpha = ana + caio; ana já está na reunião de mercado
    const draft = meeting({ id: undefined, targetType: "team", targetValue: "t1" });
    const cs = findConflicts(draft, [existente], ctx);
    expect(cs[0].personIds).toEqual(["ana"]);
  });

  it("não acusa quando ninguém em comum", () => {
    const draft = meeting({ id: undefined, targetType: "team", targetValue: "t2" }); // duda
    expect(findConflicts(draft, [existente], ctx)).toEqual([]);
  });

  it("não acusa em outro dia da semana", () => {
    const draft = meeting({ id: undefined, weekday: 3, targetType: "area", targetValue: "mercado" });
    expect(findConflicts(draft, [existente], ctx)).toEqual([]);
  });

  it("não acusa quando os horários só encostam", () => {
    const draft = meeting({
      id: undefined, startMin: 15 * 60, endMin: 16 * 60,
      targetType: "area", targetValue: "mercado",
    });
    expect(findConflicts(draft, [existente], ctx)).toEqual([]);
  });

  it("editar a própria reunião não conflita com ela mesma", () => {
    const draft = { ...existente, id: "existente" };
    expect(findConflicts(draft, [existente], ctx)).toEqual([]);
  });

  it("acusa sala ocupada mesmo sem gente em comum", () => {
    const comSala = meeting({ ...existente, id: "existente", roomId: "sala1" });
    const draft = meeting({
      id: undefined, targetType: "team", targetValue: "t2", roomId: "sala1",
    });
    const cs = findConflicts(draft, [comSala], ctx);
    expect(cs).toHaveLength(1);
    expect(cs[0].kind).toBe("room");
  });

  it("sala diferente e gente diferente convivem", () => {
    const comSala = meeting({ ...existente, id: "existente", roomId: "sala1" });
    const draft = meeting({
      id: undefined, targetType: "team", targetValue: "t2", roomId: "sala2",
    });
    expect(findConflicts(draft, [comSala], ctx)).toEqual([]);
  });

  it("explica o choque com nome, reunião e horário", () => {
    const draft = meeting({ id: undefined, targetType: "people", personIds: ["ana"] });
    const [c] = findConflicts(draft, [existente], ctx);
    const frase = describeConflict(c, { people, rooms: [] });
    expect(frase).toBe('Ana tem "Reunião de Marketing" das 14:00–15:00.');
  });

  it("explica o choque de sala pelo nome dela", () => {
    const comSala = meeting({ ...existente, id: "existente", roomId: "sala1" });
    const draft = meeting({ id: undefined, targetType: "team", targetValue: "t2", roomId: "sala1" });
    const [c] = findConflicts(draft, [comSala], ctx);
    const frase = describeConflict(c, {
      people,
      rooms: [{ id: "sala1", name: "Sala 1", color: "#000", position: 0 }],
    });
    expect(frase).toBe('Sala 1 já está ocupada por "Reunião de Marketing" das 14:00–15:00.');
  });
});

describe("formatNameList", () => {
  it("junta os nomes de forma legível", () => {
    expect(formatNameList([])).toBe("Ninguém");
    expect(formatNameList(["Ana"])).toBe("Ana");
    expect(formatNameList(["Ana", "Bia"])).toBe("Ana e Bia");
    expect(formatNameList(["Ana", "Bia", "Caio"])).toBe("Ana, Bia e Caio");
    expect(formatNameList(["Ana", "Bia", "Caio", "Duda", "Eva"])).toBe("Ana, Bia, Caio e mais 2");
  });
});

describe("grade", () => {
  it("estica a faixa de horas para caber reuniões fora do padrão", () => {
    const cedo = meeting({ startMin: 6 * 60, endMin: 7 * 60 });
    const tarde = meeting({ id: "m2", startMin: 22 * 60, endMin: 23 * 60 + 30 });
    const r = gridRange([cedo, tarde]);
    expect(r.start).toBe(6 * 60);
    expect(r.end).toBe(24 * 60);
  });

  it("mantém a faixa padrão quando tudo cabe nela", () => {
    expect(gridRange([meeting()])).toEqual({ start: 7 * 60, end: 22 * 60 });
  });

  it("reuniões que se encavalam dividem a coluna", () => {
    const a = meeting({ id: "a", startMin: 14 * 60, endMin: 15 * 60 });
    const b = meeting({ id: "b", startMin: 14 * 60 + 30, endMin: 15 * 60 + 30 });
    const l = layoutDay([a, b]);
    expect(l.get("a")).toEqual({ lane: 0, lanes: 2 });
    expect(l.get("b")).toEqual({ lane: 1, lanes: 2 });
  });

  it("reuniões seguidas ocupam a coluna inteira cada uma", () => {
    const a = meeting({ id: "a", startMin: 14 * 60, endMin: 15 * 60 });
    const b = meeting({ id: "b", startMin: 15 * 60, endMin: 16 * 60 });
    const l = layoutDay([a, b]);
    expect(l.get("a")).toEqual({ lane: 0, lanes: 1 });
    expect(l.get("b")).toEqual({ lane: 0, lanes: 1 });
  });

  it("a terceira reunião reaproveita a faixa que vagou", () => {
    // Empatando o início, a mais curta fica na primeira faixa
    const a = meeting({ id: "a", startMin: 14 * 60, endMin: 16 * 60 });
    const b = meeting({ id: "b", startMin: 14 * 60, endMin: 15 * 60 });
    const c = meeting({ id: "c", startMin: 15 * 60, endMin: 16 * 60 });
    const l = layoutDay([a, b, c]);
    expect(l.get("b")?.lane).toBe(0);
    expect(l.get("a")?.lane).toBe(1);
    expect(l.get("c")?.lane).toBe(0); // entra onde a "b" terminou
    // Só duas faixas: as três reuniões cabem lado a lado sem espremer
    expect(l.get("c")?.lanes).toBe(2);
  });
});

describe("arraste na grade", () => {
  const range = { start: 7 * 60, end: 22 * 60 };
  const PX = 64; // altura de uma hora

  it("converte a posição do ponteiro no slot de 30 minutos", () => {
    expect(slotAtOffset(0, range, PX)).toBe(7 * 60);
    expect(slotAtOffset(128, range, PX)).toBe(9 * 60);       // 2 horas abaixo
    expect(slotAtOffset(224, range, PX)).toBe(10 * 60 + 30); // 3h30 abaixo
  });

  it("arredonda para baixo, nunca para o meio de um slot", () => {
    // 20px = ~19 min depois das 07:00 → continua no slot das 07:00
    expect(slotAtOffset(20, range, PX)).toBe(7 * 60);
    // 40px = ~37 min → já é o slot das 07:30
    expect(slotAtOffset(40, range, PX)).toBe(7 * 60 + 30);
  });

  it("posição inválida não vira NaN", () => {
    expect(slotAtOffset(Number.NaN, range, PX)).toBe(range.start);
    expect(slotAtOffset(Number.POSITIVE_INFINITY, range, PX)).toBe(range.start);
  });

  it("não deixa sair da faixa visível", () => {
    expect(slotAtOffset(-500, range, PX)).toBe(range.start);
    expect(slotAtOffset(99999, range, PX)).toBe(range.end - 30);
  });

  it("soltar no mesmo slot vale meia hora", () => {
    expect(dragRange(9 * 60, 9 * 60)).toEqual({ startMin: 9 * 60, endMin: 9 * 60 + 30 });
  });

  it("arrastar para baixo cobre do início ao fim do último slot", () => {
    expect(dragRange(9 * 60, 10 * 60 + 30)).toEqual({ startMin: 9 * 60, endMin: 11 * 60 });
  });

  it("arrastar para cima dá o mesmo intervalo", () => {
    expect(dragRange(10 * 60 + 30, 9 * 60)).toEqual({ startMin: 9 * 60, endMin: 11 * 60 });
  });
});
