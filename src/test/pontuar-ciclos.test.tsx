import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { GamificationCycle } from "@/lib/gamificationCycles";

const mocks = vi.hoisted(() => ({
  awardGamificationPoints: vi.fn().mockResolvedValue(undefined),
  activeCycle: null as GamificationCycle | null,
  cycles: [] as GamificationCycle[],
  awards: [] as Array<{ id: string; personId: string; actionId: string | null; actionName: string; points: number; awardedAt: string }>,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isAdmin: true, hubStatus: "ready", activeWorkspaceId: "ws1" }),
}));

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));

vi.mock("@/hooks/useGamificationCycles", () => ({
  useGamificationCycles: () => ({
    cycles: mocks.cycles,
    activeId: mocks.activeCycle?.id ?? null,
    activeCycle: mocks.activeCycle,
    canManage: true,
    loaded: true,
    addCycle: vi.fn(),
    removeCycle: vi.fn(),
    setActiveCycle: vi.fn(),
  }),
}));

vi.mock("@/contexts/DataContext", () => ({
  useData: () => ({
    people: [{ id: "p1", name: "Ana Souza", nickname: "Ana", areas: ["mercado"] }],
    gamificationActions: [{ id: "a1", name: "Curtir e Comentar", points: 1 }],
    gamificationAwards: mocks.awards,
    awardGamificationPoints: mocks.awardGamificationPoints,
    deleteGamificationAward: vi.fn(),
    addGamificationAction: vi.fn(),
    updateGamificationAction: vi.fn(),
    deleteGamificationAction: vi.fn(),
    updatePersonNickname: vi.fn(),
    resetPersonNicknames: vi.fn(),
  }),
}));

import GamificationAdminPage from "@/pages/GamificationAdminPage";

const ciclo3: GamificationCycle = { id: "c3", name: "Ciclo 3", start: "2026-01-01", end: "2026-06-30" };
const ciclo4: GamificationCycle = { id: "c4", name: "Ciclo 4", start: "2026-08-19", end: "2026-12-31" };

const award = (id: string, points: number, awardedAt: string) =>
  ({ id, personId: "p1", actionId: "a1", actionName: "Curtir e Comentar", points, awardedAt });

const selecionarAna = () => {
  render(<MemoryRouter><GamificationAdminPage /></MemoryRouter>);
  const busca = screen.getByPlaceholderText("Digite o nome e aperte Enter");
  fireEvent.change(busca, { target: { value: "Ana" } });
  fireEvent.keyDown(busca, { key: "Enter" });
};

describe("pontos por ciclo na tela de pontuar", () => {
  beforeEach(() => {
    mocks.awardGamificationPoints.mockClear();
    mocks.cycles = [ciclo4, ciclo3];
    mocks.activeCycle = null;
    mocks.awards = [
      award("w1", 5, "2026-02-10T10:00:00.000Z"),  // Ciclo 3
      award("w2", 10, "2026-09-01T10:00:00.000Z"), // Ciclo 4
      award("w3", 7, "2025-12-01T10:00:00.000Z"),  // fora dos ciclos
    ];
  });

  it("mostra o total e a divisão por ciclo da pessoa", () => {
    selecionarAna();
    expect(screen.getByText(/22 pontos no total/)).toBeInTheDocument();

    // "Ciclo 4" também aparece no seletor de ciclo: olha só o bloco da divisão
    const bloco = screen.getByText("Pontos por ciclo").parentElement!;
    const c4 = within(bloco).getByText("Ciclo 4").closest("div")!;
    expect(within(c4).getByText("10 pts")).toBeInTheDocument();
    const c3 = within(bloco).getByText("Ciclo 3").closest("div")!;
    expect(within(c3).getByText("5 pts")).toBeInTheDocument();
  });

  it("aponta o que ficou fora de todos os ciclos", () => {
    selecionarAna();
    const fora = screen.getByText("Fora dos ciclos").closest("div")!;
    expect(within(fora).getByText("7 pts")).toBeInTheDocument();
  });

  it("sem ciclos criados não mostra a divisão", () => {
    mocks.cycles = [];
    selecionarAna();
    expect(screen.queryByText("Pontos por ciclo")).not.toBeInTheDocument();
  });

  it("com um ciclo filtrado, destaca quanto a pessoa tem nele", () => {
    mocks.activeCycle = ciclo4;
    selecionarAna();
    expect(screen.getByText(/10 no Ciclo 4/)).toBeInTheDocument();
  });
});

describe("em qual ciclo o ponto entra", () => {
  beforeEach(() => {
    mocks.awardGamificationPoints.mockClear();
    mocks.cycles = [ciclo4, ciclo3];
    mocks.awards = [];
  });

  it("sem ciclo filtrado, não força data nenhuma", async () => {
    mocks.activeCycle = null;
    selecionarAna();
    fireEvent.click(screen.getByRole("button", { name: /Curtir e Comentar/ }));

    await waitFor(() => expect(mocks.awardGamificationPoints).toHaveBeenCalled());
    const [, , quando] = mocks.awardGamificationPoints.mock.calls[0];
    expect(quando).toBeNull();
  });

  it("filtrando um ciclo já encerrado, o ponto entra dentro dele", async () => {
    mocks.activeCycle = ciclo3; // terminou em 30/06/2026
    selecionarAna();
    fireEvent.click(screen.getByRole("button", { name: /Curtir e Comentar/ }));

    await waitFor(() => expect(mocks.awardGamificationPoints).toHaveBeenCalled());
    const [pessoa, acao, quando] = mocks.awardGamificationPoints.mock.calls[0];
    expect(pessoa).toBe("p1");
    expect(acao.id).toBe("a1");
    expect(quando).toBe("2026-06-30T12:00:00.000Z");
  });

  it("avisa em qual ciclo o ponto caiu", () => {
    mocks.activeCycle = ciclo4;
    selecionarAna();
    expect(screen.getByText("Os pontos entram no Ciclo 4.")).toBeInTheDocument();
  });

  it("sem ciclo, avisa que vale a data de hoje", () => {
    mocks.activeCycle = null;
    selecionarAna();
    expect(screen.getByText("Sem ciclo escolhido: os pontos entram na data de hoje.")).toBeInTheDocument();
  });
});
