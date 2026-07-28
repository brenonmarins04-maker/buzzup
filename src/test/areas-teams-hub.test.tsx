import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const authState = vi.hoisted(() => ({
  isAdmin: false,
  activeWorkspaceId: "w1",
  myWorkspaces: [{ workspace_id: "w1", code: "BUZZ01" }],
}));
const dataState = vi.hoisted(() => ({
  loading: false,
  people: [
    { id: "p1", name: "Ana", area: "projetos", areas: ["projetos"] },
    { id: "p2", name: "Breno", area: "mercado", areas: ["mercado"] },
  ],
  teams: [
    { id: "t1", name: "Time de Vendas", memberIds: ["p1"] },
  ],
  addTeam: vi.fn(),
  updateTeam: vi.fn(),
  deleteTeam: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("@/contexts/DataContext", () => ({
  useData: () => dataState,
}));

import AreasTeamsPage from "@/pages/AreasTeamsPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <AreasTeamsPage />
    </MemoryRouter>,
  );
}

describe("AreasTeamsPage", () => {
  beforeEach(() => {
    authState.isAdmin = false;
  });

  it("separa áreas e times e oferece acesso aos respectivos espaços", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Áreas" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Times" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Geral/ })).toHaveAttribute("href", "/projetos");
    expect(screen.getByRole("link", { name: /Time de Vendas/ })).toHaveAttribute("href", "/time/t1");
  });

  it("mantém o gerenciamento de times restrito a diretores e owners", () => {
    const { rerender } = renderPage();
    expect(screen.queryByRole("button", { name: /Novo time/i })).not.toBeInTheDocument();

    authState.isAdmin = true;
    rerender(
      <MemoryRouter>
        <AreasTeamsPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /Novo time/i })).toBeInTheDocument();
    expect(screen.getByTitle("Editar Time de Vendas")).toBeInTheDocument();
    expect(screen.getByTitle("Excluir Time de Vendas")).toBeInTheDocument();
  });
});
