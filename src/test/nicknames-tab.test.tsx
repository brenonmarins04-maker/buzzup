import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  updatePersonNickname: vi.fn(),
  resetPersonNicknames: vi.fn().mockResolvedValue(2),
  people: [
    { id: "p1", name: "Ana Souza", nickname: "Aninha", areas: ["mercado"] },
    { id: "p2", name: "Luísa Prado", nickname: null, areas: ["mercado"] },
    { id: "p3", name: "Caio Reis", nickname: "Cainho", areas: ["gg"] },
    { id: "p4", name: "Duda Alves", nickname: null, areas: ["gg"] },
  ] as Array<{ id: string; name: string; nickname: string | null; areas: string[] }>,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isAdmin: true, hubStatus: "ready" }),
}));

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));

vi.mock("@/contexts/DataContext", () => ({
  useData: () => ({
    people: mocks.people,
    gamificationActions: [],
    gamificationAwards: [],
    awardGamificationPoints: vi.fn(),
    deleteGamificationAward: vi.fn(),
    addGamificationAction: vi.fn(),
    updateGamificationAction: vi.fn(),
    deleteGamificationAction: vi.fn(),
    updatePersonNickname: mocks.updatePersonNickname,
    resetPersonNicknames: mocks.resetPersonNicknames,
  }),
}));

import GamificationAdminPage from "@/pages/GamificationAdminPage";

const abrirApelidos = () => {
  render(<MemoryRouter><GamificationAdminPage /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Apelidos" }));
};

describe("aba de apelidos", () => {
  beforeEach(() => {
    mocks.updatePersonNickname.mockClear();
    mocks.resetPersonNicknames.mockClear();
  });

  it("o botão de resetar fica na mesma linha da busca", () => {
    abrirApelidos();
    const busca = screen.getByPlaceholderText("Digite o nome e aperte Enter...");
    const resetar = screen.getByRole("button", { name: /Resetar/ });
    // Mesmo contêiner = mesma linha
    expect(busca.parentElement).toBe(resetar.parentElement);
  });

  it("mostra quantos faltam por área sem precisar abrir", () => {
    abrirApelidos();
    const marketing = screen.getByRole("button", { name: /Marketing/ });
    expect(within(marketing).getByText("1 sem apelido")).toBeInTheDocument();
    expect(within(marketing).getByText("1/2")).toBeInTheDocument();
  });

  it("clicar na área revela os nomes de quem não tem apelido", () => {
    abrirApelidos();
    // Fechada, o nome não está à vista na seção da área
    expect(screen.queryByText("Sem apelido (1)")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Marketing/ }));

    expect(screen.getByText("Sem apelido (1)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Luísa Prado" })).toBeInTheDocument();
    // E quem já tem aparece junto do apelido
    expect(screen.getByText("Já têm (1)")).toBeInTheDocument();
  });

  it("clicar no nome abre o editor daquela pessoa", () => {
    abrirApelidos();
    fireEvent.click(screen.getByRole("button", { name: /Marketing/ }));
    fireEvent.click(screen.getByRole("button", { name: "Luísa Prado" }));

    expect(screen.getByText("Novo apelido")).toBeInTheDocument();
    expect(screen.getByText("Luísa Prado")).toBeInTheDocument();
  });

  it("só uma área fica aberta por vez", () => {
    abrirApelidos();
    fireEvent.click(screen.getByRole("button", { name: /Marketing/ }));
    expect(screen.getByRole("button", { name: /Marketing/ })).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("button", { name: /Financeiro/ }));
    expect(screen.getByRole("button", { name: /Marketing/ })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: /Financeiro/ })).toHaveAttribute("aria-expanded", "true");
  });

  it("a busca acha o nome sem precisar do acento", () => {
    abrirApelidos();
    const busca = screen.getByPlaceholderText("Digite o nome e aperte Enter...");

    fireEvent.change(busca, { target: { value: "luisa" } });
    const tabela = screen.getByRole("table");
    expect(within(tabela).getByText("Luísa Prado")).toBeInTheDocument();
    expect(within(tabela).queryByText("Ana Souza")).not.toBeInTheDocument();
  });
});

describe("resetar apelidos em massa", () => {
  beforeEach(() => {
    mocks.resetPersonNicknames.mockClear();
  });

  const abrirDialogo = () => {
    abrirApelidos();
    fireEvent.click(screen.getByRole("button", { name: /Resetar/ }));
    return screen.getByRole("dialog");
  };

  it("por padrão pega todo mundo que tem apelido", () => {
    const d = abrirDialogo();
    expect(within(d).getByText("2 apelidos serão apagados")).toBeInTheDocument();
    expect(within(d).getByText("Ana Souza, Caio Reis")).toBeInTheDocument();
  });

  it("filtrar por área reduz a seleção", () => {
    const d = abrirDialogo();
    fireEvent.click(within(d).getByRole("button", { name: "Marketing" }));

    expect(within(d).getByText("1 apelido será apagado")).toBeInTheDocument();
    expect(within(d).getByText("Ana Souza")).toBeInTheDocument();
    expect(within(d).queryByText(/Caio Reis/)).not.toBeInTheDocument();
  });

  it("apaga só os apelidos da área escolhida", async () => {
    const d = abrirDialogo();
    fireEvent.click(within(d).getByRole("button", { name: "Marketing" }));
    fireEvent.click(within(d).getByRole("button", { name: /^Apagar/ }));

    expect(mocks.resetPersonNicknames).toHaveBeenCalledWith(["p1"]);
  });

  it("área sem ninguém com apelido não deixa apagar", () => {
    mocks.people = [
      { id: "p9", name: "Sem Apelido", nickname: null, areas: ["mercado"] },
    ];
    const d = abrirDialogo();
    expect(within(d).getByText("Ninguém dessa seleção tem apelido para apagar.")).toBeInTheDocument();
    expect(within(d).getByRole("button", { name: /^Apagar/ })).toBeDisabled();

    // devolve o elenco para os outros testes
    mocks.people = [
      { id: "p1", name: "Ana Souza", nickname: "Aninha", areas: ["mercado"] },
      { id: "p2", name: "Luísa Prado", nickname: null, areas: ["mercado"] },
      { id: "p3", name: "Caio Reis", nickname: "Cainho", areas: ["gg"] },
      { id: "p4", name: "Duda Alves", nickname: null, areas: ["gg"] },
    ];
  });
});
