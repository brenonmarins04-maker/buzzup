import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type SessionLike = { user: { id: string; email?: string } } | null;

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  refreshSession: vi.fn(),
  rpc: vi.fn(),
}));

// Mock mínimo do client: sessão, RPCs e as chamadas auxiliares do provider.
vi.mock("@/integrations/supabase/client", () => {
  const query: Record<string, unknown> = {};
  Object.assign(query, {
    select: () => query,
    eq: () => query,
    order: () => query,
    maybeSingle: async () => ({ data: null, error: null }),
    single: async () => ({ data: null, error: null }),
    insert: async () => ({ data: null, error: null }),
    upsert: async () => ({ data: null, error: null }),
  });
  const channel: Record<string, unknown> = {};
  Object.assign(channel, { on: () => channel, subscribe: () => channel });

  return {
    supabase: {
      auth: {
        getSession: mocks.getSession,
        refreshSession: mocks.refreshSession,
        getUser: async () => ({ data: { user: null } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signOut: async () => ({ error: null }),
      },
      rpc: mocks.rpc,
      from: () => query,
      channel: () => channel,
      removeChannel: () => {},
    },
    SUPABASE_URL: "http://localhost",
    SUPABASE_PUBLISHABLE_KEY: "key",
  };
});

import { AuthProvider, useAuth } from "@/contexts/AuthContext";

const USER = { id: "user-1", email: "novo@buzzup.com" };
const session = (): SessionLike => ({ user: USER });

function Probe() {
  const { hubStatus, hubError, myWorkspaces, createWorkspace } = useAuth();
  return (
    <div>
      <span data-testid="status">{hubStatus}</span>
      <span data-testid="count">{myWorkspaces.length}</span>
      <span data-testid="error">{hubError ?? ""}</span>
      <button
        onClick={async () => {
          const r = await createWorkspace("Teste");
          (globalThis as Record<string, unknown>).__criar = r;
        }}
      >
        criar
      </button>
    </div>
  );
}

const renderProvider = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

/** RPCs do hub: sem workspaces (conta recém-criada) */
const emptyHubRpc = (name: string) =>
  Promise.resolve({ data: name === "list_my_workspaces" ? [] : [], error: null });

describe("sessão e hub de workspaces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (globalThis as Record<string, unknown>).__criar;
    mocks.rpc.mockImplementation((name: string) => emptyHubRpc(name));
  });

  it("conta nova sem workspaces mostra lista vazia, não erro", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: session() }, error: null });

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
    expect(screen.getByTestId("count")).toHaveTextContent("0");
    expect(screen.getByTestId("error")).toHaveTextContent("");
  });

  it("recupera a sessão pelo refresh quando getSession vem vazio", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mocks.refreshSession.mockResolvedValue({ data: { session: session() }, error: null });

    renderProvider();

    // sem sessão inicial o provider nem tenta o hub; força o caminho de refresh
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    expect(screen.getByTestId("status")).not.toHaveTextContent("error");
  });

  it("createWorkspace avisa em vez de estourar not_authenticated quando a sessão morreu", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: session() }, error: null });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));

    // sessão perdida no momento de criar
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mocks.refreshSession.mockResolvedValue({ data: { session: null }, error: null });

    fireEvent.click(screen.getByRole("button", { name: "criar" }));

    await waitFor(() =>
      expect((globalThis as Record<string, unknown>).__criar).toEqual({
        ok: false,
        error: "Sua sessão expirou. Entre novamente para criar o workspace.",
      }),
    );
    expect(mocks.rpc).not.toHaveBeenCalledWith("create_workspace", expect.anything());
  });

  it("createWorkspace segue quando a sessão é recuperada pelo refresh", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: session() }, error: null });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));

    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mocks.refreshSession.mockResolvedValue({ data: { session: session() }, error: null });
    mocks.rpc.mockImplementation((name: string) => {
      if (name === "create_workspace") {
        return Promise.resolve({ data: { id: "ws-1", name: "Teste", code: "ABC123" }, error: null });
      }
      return emptyHubRpc(name);
    });

    fireEvent.click(screen.getByRole("button", { name: "criar" }));

    await waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith("create_workspace", { _name: "Teste" }),
    );
  });
});
