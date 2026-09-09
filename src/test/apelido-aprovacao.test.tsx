import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import NicknamePicker from "@/components/gamification/NicknamePicker";

const mocks = vi.hoisted(() => ({
  setMyNickname: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/contexts/DataContext", () => ({
  useData: () => ({ setMyNickname: mocks.setMyNickname }),
}));

describe("escolher o próprio apelido", () => {
  beforeEach(() => mocks.setMyNickname.mockClear());

  it("sem apelido, o aviso fica vermelho e chama para escolher", () => {
    render(<NicknamePicker nickname={null} pending={null} />);
    const botao = screen.getByRole("button", { name: /ainda não escolheu um apelido/i });
    expect(botao).toHaveTextContent("⚠️");
    expect(botao).toHaveTextContent("Escolher apelido");
    expect(botao.className).toContain("text-red-600");
  });

  it("com apelido aprovado, mostra ele sem alarme", () => {
    render(<NicknamePicker nickname="Pavê" pending={null} />);
    const botao = screen.getByRole("button", { name: /Seu apelido: Pavê/ });
    expect(botao).toHaveTextContent("Pavê");
    expect(botao).not.toHaveTextContent("⚠️");
    expect(botao.className).not.toContain("text-red-600");
  });

  it("esperando aprovação, mostra o proposto em âmbar", () => {
    render(<NicknamePicker nickname={null} pending="Churros" />);
    const botao = screen.getByRole("button", { name: /"Churros" aguardando aprovação/ });
    expect(botao).toHaveTextContent("Churros");
    expect(botao.className).toContain("amber");
  });

  it("envia o apelido para aprovação em vez de aplicar direto", async () => {
    render(<NicknamePicker nickname={null} pending={null} />);
    fireEvent.click(screen.getByRole("button", { name: /ainda não escolheu/i }));

    const campo = await screen.findByPlaceholderText("Ex.: Pavê");
    fireEvent.change(campo, { target: { value: "Brigadeiro" } });
    fireEvent.click(screen.getByRole("button", { name: /Enviar para aprovação/ }));

    await waitFor(() => expect(mocks.setMyNickname).toHaveBeenCalledWith("Brigadeiro"));
  });

  it("Enter no campo também envia", async () => {
    render(<NicknamePicker nickname={null} pending={null} />);
    fireEvent.click(screen.getByRole("button", { name: /ainda não escolheu/i }));

    const campo = await screen.findByPlaceholderText("Ex.: Pavê");
    fireEvent.change(campo, { target: { value: "Sorvete" } });
    fireEvent.keyDown(campo, { key: "Enter" });

    await waitFor(() => expect(mocks.setMyNickname).toHaveBeenCalledWith("Sorvete"));
  });

  it("não envia apelido vazio", async () => {
    render(<NicknamePicker nickname={null} pending={null} />);
    fireEvent.click(screen.getByRole("button", { name: /ainda não escolheu/i }));

    await screen.findByPlaceholderText("Ex.: Pavê");
    expect(screen.getByRole("button", { name: /Enviar para aprovação/ })).toBeDisabled();
  });

  it("o campo abre com o pedido pendente, não com o aprovado", async () => {
    render(<NicknamePicker nickname="Pavê" pending="Churros" />);
    fireEvent.click(screen.getByRole("button", { name: /aguardando aprovação/ }));

    const campo = await screen.findByPlaceholderText("Ex.: Pavê");
    expect((campo as HTMLInputElement).value).toBe("Churros");
  });

  it("dá para cancelar o pedido pendente", async () => {
    render(<NicknamePicker nickname="Pavê" pending="Churros" />);
    fireEvent.click(screen.getByRole("button", { name: /aguardando aprovação/ }));

    const painel = await screen.findByPlaceholderText("Ex.: Pavê");
    expect(painel).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Cancelar pedido/ }));

    await waitFor(() => expect(mocks.setMyNickname).toHaveBeenCalledWith(null));
  });

  it("avisa que o apelido pendente ainda não vale", async () => {
    render(<NicknamePicker nickname="Pavê" pending="Churros" />);
    fireEvent.click(screen.getByRole("button", { name: /aguardando aprovação/ }));

    expect(await screen.findByText(/está esperando aprovação/)).toBeInTheDocument();
    expect(screen.getByText(/por enquanto vale/)).toBeInTheDocument();
  });
});

// --- Fila de aprovação, na aba Apelidos ---

const admin = vi.hoisted(() => ({
  people: [] as Array<{ id: string; name: string; nickname?: string | null; pendingNickname?: string | null; areas?: string[] }>,
  approve: vi.fn().mockResolvedValue(undefined),
  reject: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isAdmin: true, hubStatus: "ready", activeWorkspaceId: "ws1" }),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/hooks/useGamificationCycles", () => ({
  useGamificationCycles: () => ({
    cycles: [], activeId: null, activeCycle: null, canManage: true, loaded: true,
    addCycle: vi.fn(), removeCycle: vi.fn(), setActiveCycle: vi.fn(),
  }),
}));

describe("fila de aprovação dos diretores", () => {
  beforeEach(() => {
    admin.approve.mockClear();
    admin.reject.mockClear();
    admin.people = [
      { id: "p1", name: "Ana Souza", nickname: "Pavê", pendingNickname: "Churros", areas: ["mercado"] },
      { id: "p2", name: "Bia Lima", nickname: null, pendingNickname: null, areas: ["mercado"] },
    ];
  });

  const abrirAba = async () => {
    vi.doMock("@/contexts/DataContext", () => ({
      useData: () => ({
        people: admin.people,
        gamificationActions: [],
        gamificationAwards: [],
        awardGamificationPoints: vi.fn(),
        deleteGamificationAward: vi.fn(),
        addGamificationAction: vi.fn(),
        updateGamificationAction: vi.fn(),
        deleteGamificationAction: vi.fn(),
        updatePersonNickname: vi.fn(),
        resetPersonNicknames: vi.fn(),
        approvePendingNickname: admin.approve,
        rejectPendingNickname: admin.reject,
        setMyNickname: vi.fn(),
      }),
    }));
    const { default: Page } = await import("@/pages/GamificationAdminPage");
    const { MemoryRouter } = await import("react-router-dom");
    render(<MemoryRouter><Page /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Apelidos" }));
  };

  it("lista quem está esperando e o que pediu", async () => {
    await abrirAba();
    const titulo = screen.getByText("1 apelido esperando aprovação");
    // O nome também aparece na tabela abaixo: olha só o bloco da fila
    const fila = titulo.closest("div")!.parentElement!;
    expect(within(fila).getByText("Ana Souza")).toBeInTheDocument();
    expect(within(fila).getByText(/"Churros"/)).toBeInTheDocument();
    // Quem não pediu nada não entra na fila
    expect(within(fila).queryByText("Bia Lima")).not.toBeInTheDocument();
  });

  it("aprovar manda o apelido que o diretor viu na tela", async () => {
    await abrirAba();
    fireEvent.click(screen.getByRole("button", { name: /Aprovar/ }));
    await waitFor(() => expect(admin.approve).toHaveBeenCalledWith("p1", "Churros"));
  });

  it("recusar apenas descarta o pedido", async () => {
    await abrirAba();
    fireEvent.click(screen.getByRole("button", { name: /Recusar/ }));
    await waitFor(() => expect(admin.reject).toHaveBeenCalledWith("p1"));
  });

  it("sem pedidos, a fila nem aparece", async () => {
    admin.people = [{ id: "p2", name: "Bia Lima", nickname: null, pendingNickname: null }];
    await abrirAba();
    expect(screen.queryByText(/esperando aprovação/)).not.toBeInTheDocument();
  });
});
