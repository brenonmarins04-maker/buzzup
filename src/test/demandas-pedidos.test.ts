import { describe, expect, it } from "vitest";
import {
  buildScopes, canAdvance, clampPoints, EMPTY_DRAFT, isDraftComplete,
  isTeamScope, nextStep, pendingRequests, prevStep, scopeLabel, shortDate,
  TEAM_PREFIX, WIZARD_STEPS,
  type DemandDraft, type DemandRequest,
} from "@/lib/demandRequests";
import type { Team } from "@/contexts/DataContext";

const teams: Team[] = [
  { id: "t1", name: "Time Alpha", memberIds: ["ana"] },
  { id: "t2", name: "Time Beta", memberIds: [] },
];

const draft = (over: Partial<DemandDraft> = {}): DemandDraft => ({ ...EMPTY_DRAFT, ...over });

function pedido(over: Partial<DemandRequest> = {}): DemandRequest {
  return {
    id: "r1", area: "mercado", title: "Post", points: 2, date: "2026-09-20",
    personId: "ana", requestedBy: "u1", status: "pending",
    decidedBy: null, decidedAt: null, createdAt: "2026-09-01T10:00:00.000Z",
    ...over,
  };
}

describe("destinos da demanda", () => {
  it("junta áreas e times, com os times marcados por prefixo", () => {
    const escopos = buildScopes(teams);
    const times = escopos.filter(e => e.kind === "team");
    expect(times.map(t => t.key)).toEqual([`${TEAM_PREFIX}t1`, `${TEAM_PREFIX}t2`]);
    expect(times.map(t => t.label)).toEqual(["Time Alpha", "Time Beta"]);
  });

  it("as áreas vêm antes dos times", () => {
    const escopos = buildScopes(teams);
    const primeiroTime = escopos.findIndex(e => e.kind === "team");
    const ultimaArea = escopos.map(e => e.kind).lastIndexOf("area");
    expect(ultimaArea).toBeLessThan(primeiroTime);
  });

  it("sem times, sobram só as áreas", () => {
    expect(buildScopes([]).every(e => e.kind === "area")).toBe(true);
  });

  it("reconhece a chave de um time", () => {
    expect(isTeamScope(`${TEAM_PREFIX}t1`)).toBe(true);
    expect(isTeamScope("mercado")).toBe(false);
  });

  it("mostra o nome do time e não a chave", () => {
    expect(scopeLabel(`${TEAM_PREFIX}t1`, teams)).toBe("Time Alpha");
  });

  it("time apagado não quebra a tela", () => {
    expect(scopeLabel(`${TEAM_PREFIX}sumiu`, teams)).toBe("Time");
  });

  it("todo escopo tem cor, para o botão não sair sem cor", () => {
    for (const e of buildScopes(teams)) expect(e.color).toMatch(/^#/);
  });
});

describe("passos do formulário", () => {
  it("a ordem é escopo, demanda, prazo", () => {
    expect([...WIZARD_STEPS]).toEqual(["escopo", "demanda", "prazo"]);
  });

  it("sem escolher área não avança", () => {
    expect(canAdvance("escopo", draft())).toBe(false);
    expect(canAdvance("escopo", draft({ area: "mercado" }))).toBe(true);
  });

  it("sem nome não avança", () => {
    expect(canAdvance("demanda", draft({ area: "mercado" }))).toBe(false);
    expect(canAdvance("demanda", draft({ area: "mercado", title: "  " }))).toBe(false);
    expect(canAdvance("demanda", draft({ area: "mercado", title: "Post" }))).toBe(true);
  });

  it("o prazo é opcional: sempre dá para concluir", () => {
    expect(canAdvance("prazo", draft())).toBe(true);
    expect(canAdvance("prazo", draft({ date: "2026-09-20" }))).toBe(true);
  });

  it("navega para frente e para trás sem sair da lista", () => {
    expect(nextStep("escopo")).toBe("demanda");
    expect(nextStep("demanda")).toBe("prazo");
    expect(nextStep("prazo")).toBeNull();
    expect(prevStep("prazo")).toBe("demanda");
    expect(prevStep("escopo")).toBeNull();
  });

  it("o rascunho só fica pronto com área e nome", () => {
    expect(isDraftComplete(draft())).toBe(false);
    expect(isDraftComplete(draft({ area: "mercado" }))).toBe(false);
    expect(isDraftComplete(draft({ area: "mercado", title: "Post" }))).toBe(true);
  });
});

describe("pontos", () => {
  it("mantém o que está dentro da faixa", () => {
    expect(clampPoints(3)).toBe(3);
    expect(clampPoints(0)).toBe(0);
  });

  it("corta o que passa dos limites do banco", () => {
    expect(clampPoints(-5)).toBe(0);
    expect(clampPoints(500)).toBe(99);
  });

  it("arredonda e não deixa passar valor inválido", () => {
    expect(clampPoints(2.6)).toBe(3);
    expect(clampPoints(Number.NaN)).toBe(1);
  });
});

describe("fila dos diretores", () => {
  it("mostra só o que ainda não foi decidido", () => {
    const lista = [
      pedido({ id: "a", status: "pending" }),
      pedido({ id: "b", status: "accepted" }),
      pedido({ id: "c", status: "rejected" }),
    ];
    expect(pendingRequests(lista).map(r => r.id)).toEqual(["a"]);
  });

  it("os mais antigos aparecem primeiro", () => {
    const lista = [
      pedido({ id: "novo", createdAt: "2026-09-05T10:00:00.000Z" }),
      pedido({ id: "velho", createdAt: "2026-09-01T10:00:00.000Z" }),
    ];
    expect(pendingRequests(lista).map(r => r.id)).toEqual(["velho", "novo"]);
  });

  it("fila vazia não quebra", () => {
    expect(pendingRequests([])).toEqual([]);
  });
});

describe("prazo curto", () => {
  it("mostra dia e mês", () => {
    expect(shortDate("2026-09-20")).toBe("20/09");
  });

  it("sem data devolve vazio", () => {
    expect(shortDate("")).toBe("");
  });
});
