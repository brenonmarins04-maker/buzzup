import { describe, expect, it } from "vitest";
import {
  busyOf,
  clampIntervals,
  findCommonWindows,
  hasDeclaredSchedule,
  intersectIntervals,
  mergeIntervals,
  peopleWithoutSchedule,
  subtractIntervals,
  unavailableOf,
  type UnavailableSlot,
} from "@/lib/unavailability";
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

function slot(userId: string, weekday: number, de: number, ate: number, id = `${userId}-${de}`): UnavailableSlot {
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

describe("horários ocupados de cada conta", () => {
  const slots = [
    slot("u-ana", 1, h(9), h(12)),
    slot("u-ana", 1, h(14), h(18)),
    slot("u-ana", 2, h(9), h(10)),
    slot("u-bia", 1, h(10), h(16)),
  ];

  it("devolve só os blocos daquela conta naquele dia", () => {
    expect(unavailableOf(slots, "u-ana", 1)).toEqual([
      { startMin: h(9), endMin: h(12) },
      { startMin: h(14), endMin: h(18) },
    ]);
  });

  it("dia sem nada marcado vem vazio", () => {
    expect(unavailableOf(slots, "u-ana", 5)).toEqual([]);
  });

  it("sabe quem já marcou alguma coisa", () => {
    expect(hasDeclaredSchedule(slots, "u-ana")).toBe(true);
    expect(hasDeclaredSchedule(slots, "u-caio")).toBe(false);
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
  const base = { people, teams, limite, minDuration: 60, weekdays: [1] };

  it("cruza o que sobra livre de duas pessoas", () => {
    // Ana ocupada de manhã, Bia ocupada no fim da tarde
    const unavailability = [
      slot("u-ana", 1, h(8), h(10)),
      slot("u-bia", 1, h(16), h(18)),
    ];
    expect(findCommonWindows({ ...base, personIds: ["ana", "bia"], meetings: [], unavailability }))
      .toEqual([{ weekday: 1, startMin: h(10), endMin: h(16) }]);
  });

  it("sem nada marcado, a janela inteira serve", () => {
    expect(findCommonWindows({ ...base, personIds: ["ana", "bia"], meetings: [], unavailability: [] }))
      .toEqual([{ weekday: 1, startMin: h(8), endMin: h(18) }]);
  });

  it("um bloco ocupado no meio parte a janela em duas", () => {
    const unavailability = [slot("u-ana", 1, h(12), h(13))];
    expect(findCommonWindows({ ...base, personIds: ["ana", "bia"], meetings: [], unavailability }))
      .toEqual([
        { weekday: 1, startMin: h(8), endMin: h(12) },
        { weekday: 1, startMin: h(13), endMin: h(18) },
      ]);
  });

  it("tira também os horários de reunião já marcada", () => {
    const m = meeting({ targetType: "people", personIds: ["ana"], startMin: h(11), endMin: h(12) });
    expect(findCommonWindows({ ...base, personIds: ["ana", "bia"], meetings: [m], unavailability: [] }))
      .toEqual([
        { weekday: 1, startMin: h(8), endMin: h(11) },
        { weekday: 1, startMin: h(12), endMin: h(18) },
      ]);
  });

  it("descarta janelas menores que a duração pedida", () => {
    // Sobra só 11:30–12:00 para as duas
    const unavailability = [
      slot("u-ana", 1, h(8), h(11, 30)),
      slot("u-bia", 1, h(12), h(18)),
    ];
    expect(findCommonWindows({ ...base, personIds: ["ana", "bia"], meetings: [], unavailability }))
      .toEqual([]);
    expect(findCommonWindows({ ...base, minDuration: 30, personIds: ["ana", "bia"], meetings: [], unavailability }))
      .toEqual([{ weekday: 1, startMin: h(11, 30), endMin: h(12) }]);
  });

  it("quem não marcou nada está livre a janela toda", () => {
    // Caio não preencheu; só a agenda da Ana limita
    const unavailability = [
      slot("u-ana", 1, h(8), h(9), "a1"),
      slot("u-ana", 1, h(12), h(18), "a2"),
    ];
    expect(findCommonWindows({ ...base, personIds: ["ana", "caio"], meetings: [], unavailability }))
      .toEqual([{ weekday: 1, startMin: h(9), endMin: h(12) }]);
  });

  it("mas quem não marcou nada ainda respeita as próprias reuniões", () => {
    const unavailability = [
      slot("u-ana", 1, h(8), h(9), "a1"),
      slot("u-ana", 1, h(12), h(18), "a2"),
    ];
    const m = meeting({ targetType: "people", personIds: ["caio"], startMin: h(10), endMin: h(11) });
    expect(findCommonWindows({ ...base, minDuration: 30, personIds: ["ana", "caio"], meetings: [m], unavailability }))
      .toEqual([
        { weekday: 1, startMin: h(9), endMin: h(10) },
        { weekday: 1, startMin: h(11), endMin: h(12) },
      ]);
  });

  it("pessoa sem conta ligada conta como livre", () => {
    // Duda não tem conta: não há como ela ter marcado nada
    expect(findCommonWindows({ ...base, personIds: ["duda"], meetings: [], unavailability: [] }))
      .toEqual([{ weekday: 1, startMin: h(8), endMin: h(18) }]);
  });

  it("sem ninguém escolhido não devolve nada", () => {
    expect(findCommonWindows({ ...base, personIds: [], meetings: [], unavailability: [] })).toEqual([]);
  });

  it("agendas que não deixam brecha não devolvem horário", () => {
    const unavailability = [
      slot("u-ana", 1, h(8), h(13)),
      slot("u-bia", 1, h(13), h(18)),
    ];
    // Uma livre só à tarde, a outra só de manhã: encostam às 13:00 e nada sobra
    expect(findCommonWindows({ ...base, personIds: ["ana", "bia"], meetings: [], unavailability }))
      .toEqual([]);
  });

  it("ocupado o dia inteiro tira o dia da lista", () => {
    const unavailability = [slot("u-ana", 1, h(8), h(18))];
    expect(findCommonWindows({ ...base, personIds: ["ana"], meetings: [], unavailability }))
      .toEqual([]);
  });

  it("percorre todos os dias pedidos", () => {
    const unavailability = [
      slot("u-ana", 1, h(11), h(18), "a1"),  // segunda livre 08–11
      slot("u-bia", 3, h(8), h(14), "b3"),   // quarta livre 14–18
    ];
    expect(findCommonWindows({
      ...base, weekdays: [1, 2, 3], personIds: ["ana", "bia"], meetings: [], unavailability,
    })).toEqual([
      { weekday: 1, startMin: h(8), endMin: h(11) },
      { weekday: 2, startMin: h(8), endMin: h(18) },
      { weekday: 3, startMin: h(14), endMin: h(18) },
    ]);
  });
});

describe("quem ainda não marcou horários ocupados", () => {
  const unavailability = [slot("u-ana", 1, h(9), h(12))];

  it("aponta quem não declarou nada", () => {
    const faltando = peopleWithoutSchedule(["ana", "bia", "caio"], people, unavailability);
    expect(faltando.map(p => p.id)).toEqual(["bia", "caio"]);
  });

  it("pessoa sem conta ligada também entra na lista", () => {
    const faltando = peopleWithoutSchedule(["duda"], people, unavailability);
    expect(faltando.map(p => p.id)).toEqual(["duda"]);
  });
});
