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
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: mocks.user,
    isOwner: mocks.isOwner,
    workspaceId: mocks.workspaceId,
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
  });

  it("abre no passo de boas-vindas e avança", () => {
    renderTour();
    startTour();

    expect(screen.getByText("Bem-vindo ao BuzzUp! 🎉")).toBeInTheDocument();
    expect(screen.getByText(/Passo 1 de/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Próximo" }));
    expect(screen.getByText("Suas demandas")).toBeInTheDocument();
    expect(screen.getByText(/Passo 2 de/)).toBeInTheDocument();

    // volta um passo
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByText("Bem-vindo ao BuzzUp! 🎉")).toBeInTheDocument();
  });

  it("ao pular, fecha e marca como visto para não reaparecer", () => {
    renderTour();
    startTour();

    fireEvent.click(screen.getByRole("button", { name: "Pular" }));

    expect(screen.queryByText("Bem-vindo ao BuzzUp! 🎉")).not.toBeInTheDocument();
    expect(localStorage.getItem(tourStorageKey("user-1"))).toBe("skipped");
    expect(hasSeenTour("user-1")).toBe(true);
  });

  it("não inicia sozinho para conta antiga", () => {
    mocks.user = { id: "user-antigo", created_at: "2020-01-01T00:00:00Z" };
    renderTour();

    expect(screen.queryByText("Bem-vindo ao BuzzUp! 🎉")).not.toBeInTheDocument();
  });
});
