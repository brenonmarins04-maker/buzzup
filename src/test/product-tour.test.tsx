import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProductTour from "@/components/onboarding/ProductTour";
import { buildTourSteps, hasSeenTour, tourStorageKey } from "@/lib/tour";

const mocks = vi.hoisted(() => ({
  user: { id: "user-1", created_at: new Date().toISOString() } as { id: string; created_at: string } | null,
  isOwner: true,
  workspaceId: "ws-1" as string | null,
  isMobile: true,
  // Workspace recém-criado é o gatilho do tour
  myWorkspaces: [{ workspace_id: "ws-1", created_at: new Date().toISOString() }] as Array<{ workspace_id: string; created_at: string }>,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: mocks.user,
    isOwner: mocks.isOwner,
    workspaceId: mocks.workspaceId,
    myWorkspaces: mocks.myWorkspaces,
  }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mocks.isMobile,
}));

const renderTour = () =>
  render(
    <MemoryRouter initialEntries={["/"]}>
      <ProductTour />
    </MemoryRouter>,
  );

const startTour = () => {
  act(() => {
    window.dispatchEvent(new CustomEvent("buzzup:start-tour"));
  });
};

describe("buildTourSteps", () => {
  it("cobre início, calendário, áreas e configurações", () => {
    const ids = buildTourSteps({ areaPath: "/projetos", isOwner: false }).map(s => s.id);
    expect(ids).toEqual([
      "welcome", "my-demands", "my-points", "ranking", "shortcuts",
      "calendar", "areas", "config", "done",
    ]);
  });

  it("só mostra o passo do código de convite para o owner", () => {
    const owner = buildTourSteps({ areaPath: "/projetos", isOwner: true });
    const membro = buildTourSteps({ areaPath: "/projetos", isOwner: false });
    expect(owner.some(s => s.id === "invite")).toBe(true);
    expect(membro.some(s => s.id === "invite")).toBe(false);
  });

  it("usa a rota da área informada", () => {
    const steps = buildTourSteps({ areaPath: "/mercado", isOwner: false });
    expect(steps.find(s => s.id === "areas")?.route).toBe("/mercado");
  });
});

describe("ProductTour", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.user = { id: "user-1", created_at: new Date().toISOString() };
    mocks.isOwner = true;
    mocks.workspaceId = "ws-1";
    mocks.isMobile = true;
    mocks.myWorkspaces = [{ workspace_id: "ws-1", created_at: new Date().toISOString() }];
  });

  it("abre no passo de boas-vindas e avança", () => {
    renderTour();
    startTour();

    expect(screen.getByText("Bem-vindo ao BuzzUp! 🎉")).toBeInTheDocument();
    // O progresso é indicado só pelas bolinhas, sem o texto "Passo X de N"
    expect(screen.queryByText(/Passo \d+ de/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Próximo" }));
    expect(screen.getByText("Suas demandas")).toBeInTheDocument();
    expect(screen.queryByText(/Passo \d+ de/)).not.toBeInTheDocument();

    // volta um passo
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByText("Bem-vindo ao BuzzUp! 🎉")).toBeInTheDocument();
  });

  it("ao pular, fecha e marca como visto para não reaparecer", () => {
    renderTour();
    startTour();

    fireEvent.click(screen.getByRole("button", { name: "Pular" }));

    expect(screen.queryByText("Bem-vindo ao BuzzUp! 🎉")).not.toBeInTheDocument();
    expect(localStorage.getItem(tourStorageKey("user-1", "ws-1"))).toBe("skipped");
    expect(hasSeenTour("user-1", "ws-1")).toBe(true);
  });

  it("não inicia sozinho em workspace antigo", () => {
    mocks.myWorkspaces = [{ workspace_id: "ws-1", created_at: "2020-01-01T00:00:00Z" }];
    renderTour();

    expect(screen.queryByText("Bem-vindo ao BuzzUp! 🎉")).not.toBeInTheDocument();
  });

  it("inicia em workspace novo mesmo com conta antiga", () => {
    vi.useFakeTimers();
    try {
      mocks.user = { id: "user-antigo", created_at: "2020-01-01T00:00:00Z" };
      renderTour();
      act(() => { vi.advanceTimersByTime(1200); });
      expect(screen.getByText("Bem-vindo ao BuzzUp! 🎉")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("mostra de novo em outro workspace novo, já visto no primeiro", () => {
    // Marca o ws-1 como visto; o ws-2 (novo) ainda deve mostrar
    localStorage.setItem(tourStorageKey("user-1", "ws-1"), "done");
    expect(hasSeenTour("user-1", "ws-1")).toBe(true);
    expect(hasSeenTour("user-1", "ws-2")).toBe(false);
  });

  it("abre sozinho para conta nova ao entrar no workspace", () => {
    vi.useFakeTimers();
    try {
      renderTour();
      act(() => { vi.advanceTimersByTime(1200); });
      expect(screen.getByText("Bem-vindo ao BuzzUp! 🎉")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("ainda abre quando o papel do usuário muda antes do tour aparecer", () => {
    // Regressão: o hub carrega logo após entrar no primeiro workspace e promove
    // a pessoa a owner. O efeito reexecutava, cancelava o timer e o tour sumia.
    vi.useFakeTimers();
    try {
      mocks.isOwner = false;
      const view = renderTour();

      act(() => { vi.advanceTimersByTime(400) });
      mocks.isOwner = true; // hub carregou: virou owner
      view.rerender(
        <MemoryRouter initialEntries={["/"]}>
          <ProductTour />
        </MemoryRouter>,
      );

      act(() => { vi.advanceTimersByTime(1200); });
      expect(screen.getByText("Bem-vindo ao BuzzUp! 🎉")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("layout do tour", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.user = { id: "user-1", created_at: new Date().toISOString() };
    mocks.isOwner = true;
    mocks.workspaceId = "ws-1";
    mocks.isMobile = true;
    mocks.myWorkspaces = [{ workspace_id: "ws-1", created_at: new Date().toISOString() }];
  });

  it("não mostra o texto 'Passo X de N' em nenhum passo", () => {
    renderTour();
    startTour();
    expect(screen.queryByText(/Passo \d+ de/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Próximo" }));
    expect(screen.queryByText(/Passo \d+ de/)).not.toBeInTheDocument();
  });

  it("Voltar e Pular ocupam lugar fixo — existem sempre, invisíveis quando não valem", () => {
    renderTour();
    startTour();

    // No primeiro passo, Voltar existe mas está invisível (mantém o espaço)
    const voltar = screen.getByRole("button", { name: "Voltar" });
    expect(voltar).toHaveClass("invisible");
    expect(screen.getByRole("button", { name: "Pular" })).not.toHaveClass("invisible");

    // No segundo passo, Voltar fica visível e Pular continua lá
    fireEvent.click(screen.getByRole("button", { name: "Próximo" }));
    expect(screen.getByRole("button", { name: "Voltar" })).not.toHaveClass("invisible");
    expect(screen.getByRole("button", { name: "Pular" })).not.toHaveClass("invisible");
  });
});
