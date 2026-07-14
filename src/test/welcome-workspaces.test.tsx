import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refreshHub: vi.fn(async () => false),
  auth: {
    user: { id: "user-1", email: "breno@example.com" },
    loading: false,
    displayName: "Breno",
    myWorkspaces: [],
    trashedWorkspaces: [],
    myJoinRequests: [],
    hubStatus: "error",
    hubError: "Não foi possível carregar seus workspaces.",
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
});
