import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { DemandRequest } from "@/lib/demandRequests";

const mocks = vi.hoisted(() => ({
  addDemandRequest: vi.fn().mockResolvedValue(true),
  acceptDemandRequest: vi.fn().mockResolvedValue(undefined),
  rejectDemandRequest: vi.fn().mockResolvedValue(undefined),
  demandRequests: [] as DemandRequest[],
  isAdmin: true,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isAdmin: mocks.isAdmin, user: { id: "u1" } }),
}));

vi.mock("@/contexts/DataContext", () => ({
  useData: () => ({
    people: [{ id: "ana", name: "Ana Souza", userId: "u1", areas: ["mercado"] }],
    teams: [{ id: "t1", name: "Time Alpha", memberIds: ["ana"] }],
    demandRequests: mocks.demandRequests,
    addDemandRequest: mocks.addDemandRequest,
    acceptDemandRequest: mocks.acceptDemandRequest,
    rejectDemandRequest: mocks.rejectDemandRequest,
  }),
}));

import NewDemandWizard from "@/components/demandas/NewDemandWizard";
import DemandRequestsPage from "@/pages/DemandRequestsPage";

function pedido(over: Partial<DemandRequest> = {}): DemandRequest {
  return {
    id: "r1", area: "mercado", title: "Post no Instagram", points: 2, date: "2026-09-20",
    personId: "ana", requestedBy: "u2", status: "pending",
    decidedBy: null, decidedAt: null, createdAt: "2026-09-01T10:00:00.000Z",
    ...over,
  };
}

describe("enviar uma demanda para si", () => {
  beforeEach(() => {
    mocks.addDemandRequest.mockClear();
    mocks.addDemandRequest.mockResolvedValue(true);
  });

  const abrir = () => render(<NewDemandWizard open onOpenChange={() => {}} />);

  it("começa perguntando a área ou o time", () => {
    abrir();
    expect(screen.getByText("Para qual área ou time?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Time Alpha/ })).toBeInTheDocument();
  });

  it("escolher a área já pula para o próximo passo, num toque só", () => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: /Marketing/ }));
    expect(screen.getByText("O que você vai fazer?")).toBeInTheDocument();
  });

  it("sem nome, o botão de continuar fica travado", () => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: /Marketing/ }));
    expect(screen.getByRole("button", { name: /Continuar/ })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Nome da demanda"), { target: { value: "Post" } });
    expect(screen.getByRole("button", { name: /Continuar/ })).toBeEnabled();
  });

  it("Enter no nome leva ao passo do prazo — o fluxo do computador", () => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: /Marketing/ }));
    const campo = screen.getByLabelText("Nome da demanda");
    fireEvent.change(campo, { target: { value: "Post" } });
    fireEvent.keyDown(campo, { key: "Enter" });
    expect(screen.getByText("Tem prazo?")).toBeInTheDocument();
  });

  it("envia sem prazo: o prazo é opcional", async () => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: /Marketing/ }));
    fireEvent.change(screen.getByLabelText("Nome da demanda"), { target: { value: "Post" } });
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ }));

    expect(screen.getByText(/Sem prazo/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Enviar demanda/ }));

    await waitFor(() => expect(mocks.addDemandRequest).toHaveBeenCalledWith("mercado", "Post", 1, ""));
  });

  it("escolher um dia no calendário vira o prazo", async () => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: /Marketing/ }));
    fireEvent.change(screen.getByLabelText("Nome da demanda"), { target: { value: "Post" } });
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ }));

    // Um dia qualquer do mês aberto
    fireEvent.click(screen.getByRole("button", { name: /^15 de / }));
    fireEvent.click(screen.getByRole("button", { name: /Enviar demanda/ }));

    await waitFor(() => expect(mocks.addDemandRequest).toHaveBeenCalled());
    const [, , , data] = mocks.addDemandRequest.mock.calls[0];
    expect(data).toMatch(/^\d{4}-\d{2}-15$/);
  });

  it("dá para trocar os pontos sugeridos", async () => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: /Marketing/ }));
    fireEvent.change(screen.getByLabelText("Nome da demanda"), { target: { value: "Post" } });
    fireEvent.click(screen.getByRole("button", { name: "5" }));
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ }));
    fireEvent.click(screen.getByRole("button", { name: /Enviar demanda/ }));

    await waitFor(() => expect(mocks.addDemandRequest).toHaveBeenCalledWith("mercado", "Post", 5, ""));
  });

  it("o botão Voltar não aparece no primeiro passo", () => {
    abrir();
    expect(screen.getByRole("button", { name: /Voltar/ })).toHaveClass("invisible");
  });

  it("dá para voltar e trocar a área", () => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: /Marketing/ }));
    fireEvent.click(screen.getByRole("button", { name: /Voltar/ }));
    expect(screen.getByText("Para qual área ou time?")).toBeInTheDocument();
  });
});

describe("fila de demandas dos diretores", () => {
  beforeEach(() => {
    mocks.acceptDemandRequest.mockClear();
    mocks.rejectDemandRequest.mockClear();
    mocks.isAdmin = true;
    mocks.demandRequests = [pedido()];
  });

  it("mostra o pedido com pessoa, área, pontos e prazo", () => {
    render(<DemandRequestsPage />);
    expect(screen.getByText("Post no Instagram")).toBeInTheDocument();
    expect(screen.getByText("Marketing")).toBeInTheDocument();
    expect(screen.getByText("Ana Souza")).toBeInTheDocument();
    expect(screen.getByText("· 2 pts")).toBeInTheDocument();
    expect(screen.getByText("· até 20/09")).toBeInTheDocument();
  });

  it("aceitar direto cria a demanda com o que a pessoa mandou", async () => {
    render(<DemandRequestsPage />);
    fireEvent.click(screen.getByRole("button", { name: /Aceitar/ }));

    await waitFor(() => expect(mocks.acceptDemandRequest).toHaveBeenCalledWith("r1", {
      area: "mercado", title: "Post no Instagram", points: 2, date: "2026-09-20",
    }));
  });

  it("revisar abre os dados enviados para ajuste", () => {
    render(<DemandRequestsPage />);
    fireEvent.click(screen.getByRole("button", { name: /Revisar/ }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Revisar demanda")).toBeInTheDocument();
    expect((within(dialog).getByLabelText("Nome") as HTMLInputElement).value).toBe("Post no Instagram");
  });

  it("aceitar depois de revisar usa os dados alterados", async () => {
    render(<DemandRequestsPage />);
    fireEvent.click(screen.getByRole("button", { name: /Revisar/ }));

    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Nome"), { target: { value: "Post revisado" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "8" }));
    fireEvent.click(within(dialog).getByRole("button", { name: /Aceitar/ }));

    await waitFor(() => expect(mocks.acceptDemandRequest).toHaveBeenCalledWith("r1", {
      area: "mercado", title: "Post revisado", points: 8, date: "2026-09-20",
    }));
  });

  it("recusar apenas descarta o pedido", async () => {
    render(<DemandRequestsPage />);
    fireEvent.click(screen.getByRole("button", { name: /Revisar/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Recusar/ }));

    await waitFor(() => expect(mocks.rejectDemandRequest).toHaveBeenCalledWith("r1"));
    expect(mocks.acceptDemandRequest).not.toHaveBeenCalled();
  });

  it("pedido já decidido sai da fila", () => {
    mocks.demandRequests = [pedido({ status: "accepted" })];
    render(<DemandRequestsPage />);
    expect(screen.getByText("Nada esperando decisão.")).toBeInTheDocument();
  });

  it("quem não é líder nem diretor não vê a fila", () => {
    mocks.isAdmin = false;
    render(<DemandRequestsPage />);
    expect(screen.getByText("Esta tela é dos líderes e diretores.")).toBeInTheDocument();
    expect(screen.queryByText("Post no Instagram")).not.toBeInTheDocument();
  });
});
