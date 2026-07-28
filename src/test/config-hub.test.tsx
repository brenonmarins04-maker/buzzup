import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const authState = vi.hoisted(() => ({
  role: "member" as "member" | "leader" | "admin" | "owner",
  isAdmin: false,
  isOwner: false,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("@/hooks/usePendingJoinCount", () => ({
  usePendingJoinCount: () => 2,
}));

import ConfigHubPage from "@/pages/ConfigHubPage";

function renderHub() {
  return render(
    <MemoryRouter>
      <ConfigHubPage />
    </MemoryRouter>,
  );
}

describe("ConfigHubPage permissions", () => {
  beforeEach(() => {
    authState.role = "member";
    authState.isAdmin = false;
    authState.isOwner = false;
  });

  it("mostra somente configurações permitidas ao assessor", () => {
    renderHub();

    expect(screen.getByRole("link", { name: /Pessoas/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Áreas e Times/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Gameficação/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Relatórios/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Convites/ })).not.toBeInTheDocument();
  });

  it("mostra as configurações administrativas ao diretor, sem convites do owner", () => {
    authState.role = "admin";
    authState.isAdmin = true;
    renderHub();

    expect(screen.getByRole("link", { name: /Gameficação/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Atalhos gerais/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Relatórios/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Convites/ })).not.toBeInTheDocument();
  });

  it("mostra todas as configurações ao owner", () => {
    authState.role = "owner";
    authState.isAdmin = true;
    authState.isOwner = true;
    renderHub();

    expect(screen.getByRole("link", { name: /Gameficação/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Convites/ })).toBeInTheDocument();
  });
});
