import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * O botão que o dono usa para esconder a gamificação do workspace inteiro.
 *
 * Desligar não apaga nada — só some da tela. Por isso o cuidado maior aqui é
 * o contrário: NUNCA esconder sem ter lido do banco que está desligada. Se a
 * leitura falhar, ou se o SQL ainda não tiver rodado, a gamificação tem de
 * continuar aparecendo, como sempre apareceu.
 */

const mock = vi.hoisted(() => ({
  leitura: { data: null as Record<string, unknown> | null, error: null as unknown },
  rpc: vi.fn(),
  isOwner: true,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ activeWorkspaceId: "w1", isOwner: mock.isOwner, isAdmin: true }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const b: Record<string, unknown> = {
        select: () => b, eq: () => b,
        maybeSingle: () => Promise.resolve(mock.leitura),
      };
      return b;
    },
    rpc: (...args: unknown[]) => mock.rpc(...args),
    channel: () => {
      const c = { on: () => c, subscribe: () => c };
      return c;
    },
    removeChannel: () => Promise.resolve("ok"),
  },
}));

import { useGamificationEnabled } from "@/hooks/useGamificationEnabled";

async function montar() {
  const view = renderHook(() => useGamificationEnabled());
  await waitFor(() => expect(view.result.current.loaded).toBe(true));
  return view;
}

describe("ligar e desligar a gamificação", () => {
  beforeEach(() => {
    mock.leitura = { data: null, error: null };
    mock.rpc.mockReset().mockResolvedValue({ data: true, error: null });
    mock.isOwner = true;
  });
  afterEach(() => cleanup());

  it("sem a coluna no banco, continua ligada — é como sempre foi", async () => {
    mock.leitura = { data: null, error: { message: 'column "gamification_enabled" does not exist' } };
    const { result } = await montar();
    expect(result.current.enabled).toBe(true);
  });

  it("erro de leitura não esconde a gamificação de quem usa", async () => {
    mock.leitura = { data: null, error: new Error("offline") };
    const { result } = await montar();
    expect(result.current.enabled).toBe(true);
  });

  it("desligada no banco, fica desligada", async () => {
    mock.leitura = { data: { gamification_enabled: false }, error: null };
    const { result } = await montar();
    expect(result.current.enabled).toBe(false);
  });

  it("só o dono pode mexer no botão", async () => {
    mock.isOwner = false;
    const { result } = await montar();
    expect(result.current.canToggle).toBe(false);

    const resposta = await act(() => result.current.alternar(false));

    expect(mock.rpc).not.toHaveBeenCalled();
    expect(resposta.ok).toBe(false);
    expect(result.current.enabled).toBe(true);
  });

  it("desligar chama o banco e vale para o workspace inteiro", async () => {
    mock.rpc.mockResolvedValue({ data: false, error: null });
    const { result } = await montar();

    const resposta = await act(() => result.current.alternar(false));

    expect(resposta.ok).toBe(true);
    expect(mock.rpc).toHaveBeenCalledWith("set_gamification_enabled", { _ws_id: "w1", _enabled: false });
    expect(result.current.enabled).toBe(false);
  });

  it("se o banco recusar, o botão volta — não finge que desligou", async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { message: "not_owner" } });
    const { result } = await montar();

    const resposta = await act(() => result.current.alternar(false));

    expect(resposta.ok).toBe(false);
    expect(resposta.error).toMatch(/dono/i);
    expect(result.current.enabled).toBe(true);
  });

  it("sem o SQL rodado, o aviso diz qual arquivo rodar", async () => {
    mock.rpc.mockResolvedValue({
      data: null,
      error: { message: "Could not find the function public.set_gamification_enabled" },
    });
    const { result } = await montar();

    const resposta = await act(() => result.current.alternar(false));

    expect(resposta.error).toContain("gamificacao-liga-desliga.sql");
    expect(result.current.enabled).toBe(true);
  });
});
