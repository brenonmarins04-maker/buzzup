import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refreshHub: vi.fn(async () => false),
  auth: {
    user: { id: "user-1", email: "breno@example.com" },
    loading: false,
    displayName: "Breno",
    myWorkspaces: [] as Array<{
      workspace_id: string;
      name: string;
      code: string;
      role: "owner" | "admin" | "leader" | "member";
      created_at: string;
    }>,
    trashedWorkspaces: [],
    myJoinRequests: [],
    hubStatus: "error" as "idle" | "loading" | "ready" | "error",
    hubError: "Não foi possível carregar seus workspaces." as string | null,
    setActiveWorkspaceId: vi.fn(),
    createWorkspace: vi.fn(),
    requestJoinWorkspace: vi.fn(),
    cancelJoinRequest: vi.fn(),
    trashWorkspace: vi.fn(),
    restoreWorkspace: vi.fn(),
    signOut: vi.fn(),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ ...mocks.auth, refreshHub: mocks.refreshHub }),
}));

import WelcomePage from "@/pages/WelcomePage";

describe("workspace selection state", () => {
  beforeEach(() => {
    mocks.refreshHub.mockClear();
    mocks.auth.myWorkspaces = [];
    mocks.auth.hubStatus = "error";
    mocks.auth.hubError = "Não foi possível carregar seus workspaces.";
  });

  it("does not show a false empty workspace state when the authenticated query fails", () => {
    render(
      <MemoryRouter>
        <WelcomePage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Não conseguimos carregar seus workspaces agora.")).toBeInTheDocument();
    expect(screen.queryByText("Você ainda não participa de nenhum workspace.")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /tentar novamente/i }));
    expect(mocks.refreshHub).toHaveBeenCalledTimes(1);
  });

  it("shows the normal empty state when the account has no workspaces", () => {
    mocks.auth.hubStatus = "ready";
    mocks.auth.hubError = null;

    render(
      <MemoryRouter>
        <WelcomePage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Você ainda não participa de nenhum workspace.")).toBeInTheDocument();
    expect(screen.queryByText("Não conseguimos carregar seus workspaces agora.")).not.toBeInTheDocument();
  });

  it("renders existing workspaces after the authenticated query succeeds", () => {
    mocks.auth.hubStatus = "ready";
    mocks.auth.hubError = null;
    mocks.auth.myWorkspaces = [{
      workspace_id: "workspace-1",
      name: "PROJEC",
      code: "BUZZ-TESTE",
      role: "owner",
      created_at: "2026-05-28T04:37:40.955Z",
    }];

    render(
      <MemoryRouter>
        <WelcomePage />
      </MemoryRouter>,
    );

    expect(screen.getByText("PROJEC")).toBeInTheDocument();
    expect(screen.queryByText("Não conseguimos carregar seus workspaces agora.")).not.toBeInTheDocument();
  });
});
