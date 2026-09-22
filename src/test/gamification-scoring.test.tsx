import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const awardGamificationPoints = vi.hoisted(() => vi.fn().mockResolvedValue({ ok: true }));
const refreshGamification = vi.hoisted(() => vi.fn().mockResolvedValue(true));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isAdmin: true, hubStatus: "ready" }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => true,
}));

vi.mock("@/contexts/DataContext", () => ({
  useData: () => ({
    people: [
      { id: "p1", name: "Ana Souza", nickname: "Ana" },
      { id: "p2", name: "Bruno Lima", nickname: null },
    ],
    gamificationActions: [{ id: "a1", name: "Entregou demanda", points: 3 }],
    gamificationAwards: [],
    gamificationLastUpdatedAt: "2026-09-22T10:00:00.000Z",
    gamificationRefreshing: false,
    refreshGamification,
    awardGamificationPoints,
    deleteGamificationAward: vi.fn(),
    addGamificationAction: vi.fn(),
    updateGamificationAction: vi.fn(),
    deleteGamificationAction: vi.fn(),
    updatePersonNickname: vi.fn(),
  }),
}));

import GamificationAdminPage from "@/pages/GamificationAdminPage";

describe("pontuação móvel", () => {
  beforeEach(() => {
    awardGamificationPoints.mockClear();
    awardGamificationPoints.mockResolvedValue({ ok: true });
    refreshGamification.mockClear();
    refreshGamification.mockResolvedValue(true);
  });

  it("seleciona com Enter, pontua e deixa o nome pronto para ser substituído", async () => {
    render(
      <MemoryRouter>
        <GamificationAdminPage />
      </MemoryRouter>,
    );

    const search = screen.getByRole("textbox", { name: "Quem você quer pontuar?" }) as HTMLInputElement;
    fireEvent.change(search, { target: { value: "Ana" } });
    fireEvent.keyDown(search, { key: "Enter" });

    expect(screen.getByText("Pessoa selecionada")).toBeInTheDocument();
    expect(screen.getAllByText("Ana Souza").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Entregou demanda/ }));

    // O terceiro argumento é a data do ciclo filtrado; sem ciclo vem null e o
    // banco carimba a hora real
    await waitFor(() => expect(awardGamificationPoints).toHaveBeenCalledWith(
      "p1", expect.objectContaining({ id: "a1" }), null,
    ));
    await waitFor(() => {
      expect(search.value).toBe("Ana Souza");
      expect(search.selectionStart).toBe(0);
      expect(search.selectionEnd).toBe("Ana Souza".length);
    });

    fireEvent.change(search, { target: { value: "Bru" } });
    expect(screen.queryByText("Pessoa selecionada")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bruno Lima/ })).toBeInTheDocument();
  });

  it("recupera a tela quando o envio de pontos falha", async () => {
    awardGamificationPoints.mockRejectedValueOnce(new Error("network error"));
    render(
      <MemoryRouter>
        <GamificationAdminPage />
      </MemoryRouter>,
    );

    const search = screen.getByRole("textbox", { name: "Quem você quer pontuar?" });
    fireEvent.change(search, { target: { value: "Ana" } });
    fireEvent.keyDown(search, { key: "Enter" });

    const action = screen.getByRole("button", { name: /Entregou demanda/ });
    fireEvent.click(action);

    await waitFor(() => expect(awardGamificationPoints).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(action).toBeEnabled());
  });

  it("só atualiza a planilha de pontos quando o refresh é acionado", async () => {
    render(
      <MemoryRouter>
        <GamificationAdminPage />
      </MemoryRouter>,
    );

    expect(refreshGamification).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Atualizar gamificação" }));
    await waitFor(() => expect(refreshGamification).toHaveBeenCalledTimes(1));
  });
});
