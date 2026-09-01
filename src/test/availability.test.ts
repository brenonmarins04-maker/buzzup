import { describe, expect, it } from "vitest";
import {
  availabilityOf,
  busyOf,
  clampIntervals,
  findCommonWindows,
  hasDeclaredAvailability,
  intersectIntervals,
  mergeIntervals,
  peopleWithoutAvailability,
  subtractIntervals,
  type AvailabilitySlot,
} from "@/lib/availability";
import type { Meeting } from "@/lib/agenda";
import type { Person, Team } from "@/contexts/DataContext";

const h = (hora: number, min = 0) => hora * 60 + min;

const people: Person[] = [
  { id: "ana", name: "Ana Souza", nickname: "Ana", area: "mercado", areas: ["mercado"], userId: "u-ana" },
  { id: "bia", name: "Bia Lima", area: "mercado", areas: ["mercado"], userId: "u-bia" },
  { id: "caio", name: "Caio Reis", area: "gg", areas: ["gg"], userId: "u-caio" },
  // Sem conta ligada: nunca terá disponibilidade declarada
  { id: "duda", name: "Duda Alves", area: null, areas: [], userId: null },
];

const teams: Team[] = [{ id: "t1", name: "Time Alpha", memberIds: ["ana", "caio"] }];

function slot(userId: string, weekday: number, de: number, ate: number, id = `${userId}-${de}`): AvailabilitySlot {
  return { id, userId, weekday, startMin: de, endMin: ate };
}

function meeting(over: Partial<Meeting> = {}): Meeting {
  return {
    id: "m1", title: "Reunião", description: "", roomId: null,
    weekday: 1, startMin: h(10), endMin: h(11),
    targetType: "people", targetValue: null, personIds: [],
    createdBy: null, createdAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("aritmética de intervalos", () => {
  it("junta blocos que se sobrepõem", () => {
    expect(mergeIntervals([
      { startMin: h(9), endMin: h(11) },
      { startMin: h(10), endMin: h(12) },
    ])).toEqual([{ startMin: h(9), endMin: h(12) }]);
  });

  it("junta blocos que só se encostam", () => {
    expect(mergeIntervals([
      { startMin: h(9), endMin: h(10) },
      { startMin: h(10), endMin: h(11) },
    ])).toEqual([{ startMin: h(9), endMin: h(11) }]);
  });

  it("mantém separados os blocos com buraco entre eles", () => {
    expect(mergeIntervals([
      { startMin: h(9), endMin: h(10) },
      { startMin: h(11), endMin: h(12) },
    ])).toEqual([
      { startMin: h(9), endMin: h(10) },
      { startMin: h(11), endMin: h(12) },
    ]);
  });

  it("descarta blocos vazios ou invertidos", () => {
    expect(mergeIntervals([{ startMin: h(9), endMin: h(9) }])).toEqual([]);
    expect(mergeIntervals([{ startMin: h(11), endMin: h(9) }])).toEqual([]);
  });

  it("cruza duas listas pegando só o que há em comum", () => {
    const a = [{ startMin: h(9), endMin: h(12) }];
    const b = [{ startMin: h(11), endMin: h(14) }];
    expect(intersectIntervals(a, b)).toEqual([{ startMin: h(11), endMin: h(12) }]);
  });

  it("cruzamento sem sobreposição dá vazio", () => {
    expect(intersectIntervals(
      [{ startMin: h(9), endMin: h(10) }],
      [{ startMin: h(10), endMin: h(11) }],
    )).toEqual([]);
  });

  it("cruza listas com vários blocos de cada lado", () => {
    const a = [{ startMin: h(9), endMin: h(12) }, { startMin: h(14), endMin: h(18) }];
    const b = [{ startMin: h(11), endMin: h(15) }, { startMin: h(16), endMin: h(17) }];
    expect(intersectIntervals(a, b)).toEqual([
      { startMin: h(11), endMin: h(12) },
      { startMin: h(14), endMin: h(15) },
      { startMin: h(16), endMin: h(17) },
    ]);
  });

  it("subtrair no meio abre um buraco", () => {
    expect(subtractIntervals(
      [{ startMin: h(9), endMin: h(12) }],
      [{ startMin: h(10), endMin: h(11) }],
    )).toEqual([
      { startMin: h(9), endMin: h(10) },
      { startMin: h(11), endMin: h(12) },
    ]);
  });

  it("subtrair a ponta encurta o bloco", () => {
    expect(subtractIntervals(
      [{ startMin: h(9), endMin: h(12) }],
      [{ startMin: h(8), endMin: h(10) }],
    )).toEqual([{ startMin: h(10), endMin: h(12) }]);
  });

  it("subtrair tudo não deixa nada", () => {
    expect(subtractIntervals(
      [{ startMin: h(9), endMin: h(12) }],
      [{ startMin: h(8), endMin: h(13) }],
    )).toEqual([]);
  });

  it("recorta para a janela pedida", () => {
    expect(clampIntervals(
      [{ startMin: h(6), endMin: h(20) }, { startMin: h(21), endMin: h(22) }],
      { startMin: h(8), endMin: h(18) },
    )).toEqual([{ startMin: h(8), endMin: h(18) }]);
  });
});

describe("disponibilidade de cada conta", () => {
  const slots = [
    slot("u-ana", 1, h(9), h(12)),
    slot("u-ana", 1, h(14), h(18)),
    slot("u-ana", 2, h(9), h(10)),
    slot("u-bia", 1, h(10), h(16)),
  ];

  it("devolve só os blocos daquela conta naquele dia", () => {
    expect(availabilityOf(slots, "u-ana", 1)).toEqual([
      { startMin: h(9), endMin: h(12) },
      { startMin: h(14), endMin: h(18) },
    ]);
  });

  it("dia sem nada marcado vem vazio", () => {
    expect(availabilityOf(slots, "u-ana", 5)).toEqual([]);
  });

  it("sabe quem já marcou alguma coisa", () => {
    expect(hasDeclaredAvailability(slots, "u-ana")).toBe(true);
    expect(hasDeclaredAvailability(slots, "u-caio")).toBe(false);
  });
});

describe("horários ocupados por reunião", () => {
  it("conta a reunião de um time como ocupação de cada membro", () => {
    const m = meeting({ targetType: "team", targetValue: "t1", startMin: h(10), endMin: h(11) });
    expect(busyOf([m], "ana", 1, { people, teams })).toEqual([{ startMin: h(10), endMin: h(11) }]);
    expect(busyOf([m], "bia", 1, { people, teams })).toEqual([]);
  });

  it("ignora reunião de outro dia", () => {
    const m = meeting({ weekday: 3, targetType: "people", personIds: ["ana"] });
    expect(busyOf([m], "ana", 1, { people, teams })).toEqual([]);
  });
});

describe("achar horário em comum", () => {
  const limite = { startMin: h(8), endMin: h(18) };
  const base = {
    people, teams, limite, minDuration: 60, weekdays: [1],
  };

  it("cruza a disponibilidade de duas pessoas", () => {
    const availability = [
      slot("u-ana", 1, h(9), h(12)),
      slot("u-bia", 1, h(11), h(15)),
    ];
    expect(findCommonWindows({ ...base, personIds: ["ana", "bia"], meetings: [], availability }))
      .toEqual([{ weekday: 1, startMin: h(11), endMin: h(12) }]);
  });

  it("respeita o limite de começo e fim", () => {
    const availability = [
      slot("u-ana", 1, h(6), h(22)),
      slot("u-bia", 1, h(6), h(22)),
    ];
    expect(findCommonWindows({ ...base, personIds: ["ana", "bia"], meetings: [], availability }))
      .toEqual([{ weekday: 1, startMin: h(8), endMin: h(18) }]);
  });

  it("tira os horários já ocupados por reunião", () => {
    const availability = [
      slot("u-ana", 1, h(9), h(17)),
      slot("u-bia", 1, h(9), h(17)),
    ];
    const m = meeting({ targetType: "people", personIds: ["ana"], startMin: h(11), endMin: h(12) });
    expect(findCommonWindows({ ...base, personIds: ["ana", "bia"], meetings: [m], availability }))
      .toEqual([
        { weekday: 1, startMin: h(9), endMin: h(11) },
        { weekday: 1, startMin: h(12), endMin: h(17) },
      ]);
  });

  it("descarta janelas menores que a duração pedida", () => {
    const availability = [
      slot("u-ana", 1, h(9), h(12)),
      slot("u-bia", 1, h(11, 30), h(15)),
    ];
    // Sobra só 11:30–12:00, meia hora
    expect(findCommonWindows({ ...base, personIds: ["ana", "bia"], meetings: [], availability }))
      .toEqual([]);
    // Com meia hora de reunião, serve
    expect(findCommonWindows({ ...base, minDuration: 30, personIds: ["ana", "bia"], meetings: [], availability }))
      .toEqual([{ weekday: 1, startMin: h(11, 30), endMin: h(12) }]);
  });

  it("quem não marcou disponibilidade conta como livre na janela toda", () => {
    const availability = [slot("u-ana", 1, h(9), h(12))];
    // Caio não marcou nada: não deve zerar o resultado
    expect(findCommonWindows({ ...base, personIds: ["ana", "caio"], meetings: [], availability }))
      .toEqual([{ weekday: 1, startMin: h(9), endMin: h(12) }]);
  });

  it("mas quem não marcou ainda respeita as próprias reuniões", () => {
    const availability = [slot("u-ana", 1, h(9), h(12))];
    const m = meeting({ targetType: "people", personIds: ["caio"], startMin: h(10), endMin: h(11) });
    expect(findCommonWindows({ ...base, minDuration: 30, personIds: ["ana", "caio"], meetings: [m], availability }))
      .toEqual([
        { weekday: 1, startMin: h(9), endMin: h(10) },
        { weekday: 1, startMin: h(11), endMin: h(12) },
      ]);
  });

  it("sem ninguém escolhido não devolve nada", () => {
    expect(findCommonWindows({ ...base, personIds: [], meetings: [], availability: [] })).toEqual([]);
  });

  it("agendas que não se cruzam não devolvem horário", () => {
    const availability = [
      slot("u-ana", 1, h(9), h(10)),
      slot("u-bia", 1, h(15), h(16)),
    ];
    expect(findCommonWindows({ ...base, personIds: ["ana", "bia"], meetings: [], availability }))
      .toEqual([]);
  });

  it("percorre todos os dias pedidos", () => {
    const availability = [
      slot("u-ana", 1, h(9), h(11), "a1"),
      slot("u-bia", 1, h(9), h(11), "b1"),
      slot("u-ana", 3, h(14), h(16), "a3"),
      slot("u-bia", 3, h(14), h(16), "b3"),
    ];
    expect(findCommonWindows({
      ...base, weekdays: [1, 2, 3], personIds: ["ana", "bia"], meetings: [], availability,
    })).toEqual([
      { weekday: 1, startMin: h(9), endMin: h(11) },
      { weekday: 3, startMin: h(14), endMin: h(16) },
    ]);
  });
});

describe("quem ainda não marcou disponibilidade", () => {
  const availability = [slot("u-ana", 1, h(9), h(12))];

  it("aponta quem não declarou nada", () => {
    const faltando = peopleWithoutAvailability(["ana", "bia", "caio"], people, availability);
    expect(faltando.map(p => p.id)).toEqual(["bia", "caio"]);
  });

  it("pessoa sem conta ligada também entra na lista", () => {
    const faltando = peopleWithoutAvailability(["duda"], people, availability);
    expect(faltando.map(p => p.id)).toEqual(["duda"]);
  });
});
