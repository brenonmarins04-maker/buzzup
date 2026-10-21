import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataProvider, useData } from "@/contexts/DataContext";

/**
 * A demanda tem de aparecer no instante do clique.
 *
 * Antes ela só entrava na lista depois da resposta do banco. Numa rede de
 * celular isso são segundos olhando para um calendário parado, e a sensação é
 * de que não salvou — quem criava clicava de novo e saía demanda duplicada.
 *
 * Aqui a ida ao banco fica presa de propósito: o que importa é o que a tela
 * mostra ENQUANTO ela não volta.
 */

type Resultado = { data: Record<string, unknown> | null; error: unknown };
type Payload = { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> };

const mock = vi.hoisted(() => ({
  inserts: [] as { resolver: (r: Resultado) => void }[],
  canais: [] as { handlers: Map<string, (p: Payload) => void> }[],
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-a" }, workspaceId: "workspace-a", isAdmin: true, isOwner: true }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: () => Promise.resolve({ data: null, error: null }),
    from: () => {
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder, or: () => builder, order: () => builder,
        gt: () => builder, limit: () => builder,
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        upsert: () => Promise.resolve({ data: null, error: null }),
        insert: () => builder,
        // A inserção fica pendurada até o teste decidir como ela termina.
        single: () => new Promise<Resultado>(resolve => { mock.inserts.push({ resolver: resolve }); }),
        then: (resolve: (r: { data: unknown[]; error: unknown }) => void) =>
          Promise.resolve({ data: [], error: null }).then(resolve),
      };
      return builder;
    },
    channel: () => {
      const canal = {
        handlers: new Map<string, (p: Payload) => void>(),
        on: (_e: string, config: { table: string }, cb: (p: Payload) => void) => { canal.handlers.set(config.table, cb); return canal; },
        subscribe: () => canal,
      };
      mock.canais.push(canal);
      return canal;
    },
    removeChannel: () => Promise.resolve("ok"),
  },
}));

let atual: ReturnType<typeof useData>;
function Sonda() { atual = useData(); return null; }

const linhaDoServidor = {
  id: "demanda-real", area: "team_vendas", person_id: null,
  title: "Fechar proposta", description: "", date: "2026-07-07",
  position: 0, status: "in-progress", points: 1,
};

async function montar() {
  render(<DataProvider><Sonda /></DataProvider>);
  await act(async () => { await Promise.resolve(); });
  mock.inserts.length = 0;
}

const criar = () => act(() => {
  void atual.addParkingItem("team_vendas", "Fechar proposta", "2026-07-07");
});

const responder = (r: Resultado) => act(async () => {
  mock.inserts[0].resolver(r);
  await Promise.resolve();
});

describe("demanda nova aparece na hora", () => {
  beforeEach(() => { mock.inserts.length = 0; mock.canais.length = 0; });
  afterEach(() => cleanup());

  it("entra na lista antes de o banco responder", async () => {
    await montar();
    await criar();

    expect(mock.inserts).toHaveLength(1); // a ida ao banco ainda está pendurada
    expect(atual.parkingItems).toHaveLength(1);
    expect(atual.parkingItems[0].title).toBe("Fechar proposta");
    expect(atual.parkingItems[0].date).toBe("2026-07-07");
    expect(atual.parkingItems[0].area).toBe("team_vendas");
  });

  it("a resposta do servidor só troca o id, sem duplicar", async () => {
    await montar();
    await criar();
    const provisorio = atual.parkingItems[0].id;

    await responder({ data: linhaDoServidor, error: null });

    expect(atual.parkingItems).toHaveLength(1);
    expect(atual.parkingItems[0].id).toBe("demanda-real");
    expect(atual.parkingItems[0].id).not.toBe(provisorio);
  });

  it("se o realtime chegar primeiro, continua sendo uma só", async () => {
    await montar();
    await criar();

    // O aviso do realtime passa na frente da resposta do insert
    await act(async () => {
      mock.canais.at(-1)!.handlers.get("parking_items")!({
        eventType: "INSERT", new: { ...linhaDoServidor, workspace_id: "workspace-a" }, old: {},
      });
      await Promise.resolve();
    });
    await responder({ data: linhaDoServidor, error: null });

    expect(atual.parkingItems).toHaveLength(1);
    expect(atual.parkingItems[0].id).toBe("demanda-real");
  });

  it("se o banco recusar, a demanda some — não fica fingindo que salvou", async () => {
    await montar();
    await criar();
    expect(atual.parkingItems).toHaveLength(1);

    await responder({ data: null, error: new Error("sem permissão") });

    expect(atual.parkingItems).toHaveLength(0);
  });
});
