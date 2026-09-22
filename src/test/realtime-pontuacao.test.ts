import { describe, expect, it } from "vitest";

/**
 * Regressão de desempenho: cada ponto dado disparava o download de TODAS as
 * pontuações do workspace. Com a tabela grande, a tela travava a cada clique.
 *
 * A lógica do encaixe incremental está dentro do DataContext (precisa do
 * workspace e do setState), então aqui reproduzimos exatamente o mesmo
 * algoritmo e travamos o comportamento esperado.
 */

type Award = { id: string; personId: string; points: number; awardedAt: string };

function mapAward(w: Record<string, unknown>): Award {
  return {
    id: w.id as string,
    personId: w.person_id as string,
    points: (w.points as number) ?? 0,
    awardedAt: w.awarded_at as string,
  };
}

/** Mesmo algoritmo do DataContext. Devolve a lista nova e se recarregou. */
function aplicarEvento(
  atual: Award[],
  payload: { eventType?: string; new?: Record<string, unknown>; old?: Record<string, unknown> },
  wsId = "ws1",
): { lista: Award[]; recarregou: boolean } {
  const linha = payload.new ?? payload.old;
  if (linha?.workspace_id && linha.workspace_id !== wsId) {
    return { lista: atual, recarregou: false };
  }

  if (payload.eventType === "INSERT" && payload.new) {
    const novo = mapAward(payload.new);
    return {
      lista: atual.some(a => a.id === novo.id) ? atual : [novo, ...atual],
      recarregou: false,
    };
  }
  if (payload.eventType === "UPDATE" && payload.new) {
    const at = mapAward(payload.new);
    return { lista: atual.map(a => a.id === at.id ? at : a), recarregou: false };
  }
  if (payload.eventType === "DELETE" && payload.old?.id) {
    const id = payload.old.id;
    return { lista: atual.filter(a => a.id !== id), recarregou: false };
  }
  return { lista: atual, recarregou: true };
}

const linha = (id: string, extra: Record<string, unknown> = {}) => ({
  id, person_id: "ana", points: 2, awarded_at: "2026-09-20T10:00:00.000Z",
  workspace_id: "ws1", ...extra,
});

const existente: Award[] = [
  { id: "a1", personId: "ana", points: 5, awardedAt: "2026-09-19T10:00:00.000Z" },
];

describe("pontuação chega pelo evento, sem rebaixar tudo", () => {
  it("um ponto novo entra na lista sem recarregar", () => {
    const r = aplicarEvento(existente, { eventType: "INSERT", new: linha("a2") });
    expect(r.recarregou).toBe(false);
    expect(r.lista.map(a => a.id)).toEqual(["a2", "a1"]);
  });

  it("o mais recente fica no topo", () => {
    const r = aplicarEvento(existente, { eventType: "INSERT", new: linha("a2") });
    expect(r.lista[0].id).toBe("a2");
  });

  it("o mesmo ponto chegando duas vezes não duplica", () => {
    // Acontece de verdade: quem pontuou já aplicou na hora, e o evento chega depois
    const um = aplicarEvento(existente, { eventType: "INSERT", new: linha("a2") });
    const dois = aplicarEvento(um.lista, { eventType: "INSERT", new: linha("a2") });
    expect(dois.lista.map(a => a.id)).toEqual(["a2", "a1"]);
  });

  it("remoção tira só aquele ponto", () => {
    const r = aplicarEvento(existente, { eventType: "DELETE", old: linha("a1") });
    expect(r.recarregou).toBe(false);
    expect(r.lista).toEqual([]);
  });

  it("edição troca a linha no lugar", () => {
    const r = aplicarEvento(existente, { eventType: "UPDATE", new: linha("a1", { points: 9 }) });
    expect(r.lista).toHaveLength(1);
    expect(r.lista[0].points).toBe(9);
  });

  it("evento de outro workspace é ignorado", () => {
    const r = aplicarEvento(existente, {
      eventType: "INSERT", new: linha("intruso", { workspace_id: "ws2" }),
    });
    expect(r.lista).toEqual(existente);
    expect(r.recarregou).toBe(false);
  });

  it("evento estranho cai no plano B: recarrega", () => {
    const r = aplicarEvento(existente, { eventType: "TRUNCATE" });
    expect(r.recarregou).toBe(true);
    expect(r.lista).toEqual(existente);
  });

  it("dez pontos seguidos não recarregam nenhuma vez", () => {
    let lista = existente;
    let recargas = 0;
    for (let i = 0; i < 10; i++) {
      const r = aplicarEvento(lista, { eventType: "INSERT", new: linha(`novo-${i}`) });
      lista = r.lista;
      if (r.recarregou) recargas += 1;
    }
    expect(recargas).toBe(0);
    expect(lista).toHaveLength(11);
  });
});
