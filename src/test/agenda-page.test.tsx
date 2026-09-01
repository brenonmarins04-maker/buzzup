import { createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AgendaPage from "@/pages/AgendaPage";
import type { Meeting, MeetingRoom } from "@/lib/agenda";
import type { AvailabilitySlot } from "@/lib/availability";
import type { Person, Team } from "@/contexts/DataContext";

const mocks = vi.hoisted(() => ({
  isAdmin: true,
  userId: "u1",
  isMobile: false,
  people: [
    { id: "ana", name: "Ana Souza", nickname: "Ana", area: "mercado", areas: ["mercado"], userId: "u1" },
    { id: "bia", name: "Bia Lima", area: "mercado", areas: ["mercado"], userId: "u2" },
    { id: "caio", name: "Caio Reis", area: "gg", areas: ["gg"], userId: "u3" },
  ] as Person[],
  teams: [{ id: "t1", name: "Time Alpha", memberIds: ["caio"] }] as Team[],
  meetings: [] as Meeting[],
  meetingRooms: [] as MeetingRoom[],
  availability: [] as AvailabilitySlot[],
  setMyAvailabilityForDay: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isAdmin: mocks.isAdmin, user: { id: mocks.userId } }),
}));

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => mocks.isMobile }));

vi.mock("@/contexts/DataContext", () => ({
  useData: () => ({
    people: mocks.people,
    teams: mocks.teams,
    meetings: mocks.meetings,
    meetingRooms: mocks.meetingRooms,
    availability: mocks.availability,
    setMyAvailabilityForDay: mocks.setMyAvailabilityForDay,
    addMeeting: vi.fn(),
    updateMeeting: vi.fn(),
    deleteMeeting: vi.fn(),
    addMeetingRoom: vi.fn(),
    updateMeetingRoom: vi.fn(),
    deleteMeetingRoom: vi.fn(),
  }),
}));

function meeting(over: Partial<Meeting> = {}): Meeting {
  return {
    id: "m1", title: "Reunião de Marketing", description: "", roomId: null,
    weekday: 1, startMin: 14 * 60, endMin: 15 * 60,
    targetType: "area", targetValue: "mercado", personIds: [],
    createdBy: null, createdAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

const renderPage = () => render(<MemoryRouter><AgendaPage /></MemoryRouter>);

describe("AgendaPage", () => {
  beforeEach(() => {
    mocks.isAdmin = true;
    mocks.isMobile = false;
    mocks.meetings = [];
    mocks.meetingRooms = [{ id: "sala1", name: "Sala 1", color: "#00B4D8", position: 0 }];
  });

  it("mostra a semana e o aviso de agenda vazia", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: /Agenda/ })).toBeInTheDocument();
    for (const dia of ["Seg", "Ter", "Qua", "Qui", "Sex"]) {
      expect(screen.getByText(dia)).toBeInTheDocument();
    }
    // Fim de semana fica escondido até pedirem
    expect(screen.queryByText("Sáb")).not.toBeInTheDocument();
    expect(screen.getByText("Nenhuma reunião marcada ainda.")).toBeInTheDocument();
  });

  it("mostra o fim de semana quando o filtro é ligado", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Fim de semana" }));
    expect(screen.getByText("Sáb")).toBeInTheDocument();
    expect(screen.getByText("Dom")).toBeInTheDocument();
  });

  it("lista a reunião com horário, área e sala", () => {
    mocks.meetings = [meeting({ roomId: "sala1" })];
    renderPage();
    expect(screen.getAllByText("Reunião de Marketing").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/14:00–15:00/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Sala 1 · 1h/)).toBeInTheDocument();
  });

  it("filtra por sala", () => {
    mocks.meetings = [
      meeting({ id: "a", title: "Com sala", roomId: "sala1" }),
      meeting({ id: "b", title: "Avulsa", roomId: null, startMin: 16 * 60, endMin: 17 * 60 }),
    ];
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Sem sala" }));
    expect(screen.queryByText("Com sala")).not.toBeInTheDocument();
    expect(screen.getAllByText("Avulsa").length).toBeGreaterThan(0);
  });

  it("o filtro 'Minhas' deixa só as reuniões em que eu entro", () => {
    mocks.meetings = [
      // Ana (eu) está em mercado
      meeting({ id: "a", title: "Minha reunião", targetType: "area", targetValue: "mercado" }),
      // Time Alpha = só o Caio
      meeting({ id: "b", title: "Reunião alheia", targetType: "team", targetValue: "t1" }),
    ];
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Minhas/ }));
    expect(screen.getAllByText("Minha reunião").length).toBeGreaterThan(0);
    expect(screen.queryByText("Reunião alheia")).not.toBeInTheDocument();
  });

  it("quem não é diretor nem líder só consulta", () => {
    mocks.isAdmin = false;
    mocks.meetings = [meeting()];
    renderPage();
    expect(screen.queryByRole("button", { name: /Nova reunião/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Salas$/ })).not.toBeInTheDocument();
    // Os espaços vagos continuam desenhados, mas não clicáveis
    const vagos = screen.getAllByRole("button", { name: /Marcar reunião às/ });
    expect(vagos.length).toBeGreaterThan(0);
    for (const v of vagos) expect(v).toBeDisabled();
    // E a reunião existente não abre para edição
    expect(screen.getAllByRole("button", { name: /Reunião de Marketing/ })[0]).toBeDisabled();
  });

  it("no celular mostra um dia por vez", () => {
    mocks.isMobile = true;
    mocks.meetings = [meeting({ weekday: 1 })];
    renderPage();
    // O dia inicial é o de hoje; escolhe segunda para o teste não depender disso
    fireEvent.click(screen.getByRole("button", { name: "Seg" }));
    // O cabeçalho da grade traz o dia por extenso, não a semana toda
    expect(screen.getAllByText("Segunda").length).toBeGreaterThan(0);
    expect(screen.queryByText("Quarta")).not.toBeInTheDocument();
  });
});

describe("MeetingModal — conflitos", () => {
  beforeEach(() => {
    mocks.isAdmin = true;
    mocks.isMobile = false;
    mocks.meetingRooms = [{ id: "sala1", name: "Sala 1", color: "#00B4D8", position: 0 }];
    // Segunda 14–15 com o Time Alpha (Caio) — que é justamente a seleção
    // padrão do formulário, então abrir às 14:00 já cai em cima dela.
    mocks.meetings = [meeting({ targetType: "team", targetValue: "t1" })];
  });

  it("avisa quem já tem reunião ao tentar marcar por cima", () => {
    renderPage();
    fireEvent.click(screen.getAllByRole("button", { name: /Marcar reunião às 14:00/ })[0]);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Esse horário já está ocupado")).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Caio Reis tem "Reunião de Marketing" das 14:00–15:00/),
    ).toBeInTheDocument();
  });

  it("o botão de salvar fica travado até confirmar o conflito", () => {
    renderPage();
    fireEvent.click(screen.getAllByRole("button", { name: /Marcar reunião às 14:00/ })[0]);
    const dialog = screen.getByRole("dialog");

    fireEvent.change(within(dialog).getByPlaceholderText(/Reunião de Marketing/), {
      target: { value: "Nova pauta" },
    });

    const salvar = within(dialog).getByRole("button", { name: "Marcar reunião" });
    expect(salvar).toBeDisabled();

    fireEvent.click(within(dialog).getByRole("checkbox"));
    expect(salvar).toBeEnabled();
  });

  it("clicar num horário livre abre o formulário sem aviso nenhum", () => {
    renderPage();
    fireEvent.click(screen.getAllByRole("button", { name: /Marcar reunião às 09:00/ })[0]);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Nova reunião")).toBeInTheDocument();
    expect(within(dialog).queryByText("Esse horário já está ocupado")).not.toBeInTheDocument();
  });

  it("mudar o dia da semana resolve o conflito", () => {
    renderPage();
    fireEvent.click(screen.getAllByRole("button", { name: /Marcar reunião às 14:00/ })[0]);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Esse horário já está ocupado")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Qua" }));
    expect(within(dialog).queryByText("Esse horário já está ocupado")).not.toBeInTheDocument();
  });
});

describe("arrastar na grade para marcar", () => {
  beforeEach(() => {
    mocks.isAdmin = true;
    mocks.isMobile = false;
    mocks.meetings = [];
    mocks.meetingRooms = [{ id: "sala1", name: "Sala 1", color: "#00B4D8", position: 0 }];
  });

  /** A coluna do dia é o pai dos espaços vagos daquele dia. */
  const colunaDe = (rotulo: RegExp) =>
    screen.getAllByRole("button", { name: rotulo })[0].parentElement as HTMLElement;

  /**
   * O jsdom não implementa PointerEvent, então clientY e pointerType não
   * sobrevivem ao fireEvent comum — é preciso cravá-los no evento.
   */
  const ponteiro = (
    tipo: "pointerDown" | "pointerMove" | "pointerUp",
    el: HTMLElement,
    { clientY, pointerType = "mouse" }: { clientY: number; pointerType?: string },
  ) => {
    const ev = createEvent[tipo](el, { bubbles: true });
    Object.defineProperty(ev, "clientY", { value: clientY });
    Object.defineProperty(ev, "button", { value: 0 });
    Object.defineProperty(ev, "pointerId", { value: 1 });
    Object.defineProperty(ev, "pointerType", { value: pointerType });
    fireEvent(el, ev);
  };

  /** Arrasta de um ponto a outro dentro da coluna. */
  const arrastar = (el: HTMLElement, de: number, ate: number, pointerType = "mouse") => {
    ponteiro("pointerDown", el, { clientY: de, pointerType });
    ponteiro("pointerMove", el, { clientY: ate, pointerType });
    ponteiro("pointerUp", el, { clientY: ate, pointerType });
  };

  it("arrastar de 09:00 até 10:30 abre o formulário das 09:00 às 11:00", () => {
    renderPage();
    const coluna = colunaDe(/Marcar reunião às 09:00/);

    // A grade começa às 07:00 e cada hora tem 64px: 128px = 09:00, 224px = 10:30
    arrastar(coluna, 128, 224);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("09:00 às 11:00 · 2h")).toBeInTheDocument();
  });

  it("arrastar para cima dá o mesmo intervalo", () => {
    renderPage();
    const coluna = colunaDe(/Marcar reunião às 09:00/);

    arrastar(coluna, 224, 128);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("09:00 às 11:00 · 2h")).toBeInTheDocument();
  });

  it("clicar num retângulo marca meia hora", () => {
    renderPage();
    fireEvent.click(screen.getAllByRole("button", { name: /Marcar reunião às 09:00/ })[0]);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("09:00 às 09:30 · 30min")).toBeInTheDocument();
  });

  it("o toque não arrasta — na tela pequena o gesto vertical é rolagem", () => {
    renderPage();
    const coluna = colunaDe(/Marcar reunião às 09:00/);

    arrastar(coluna, 128, 224, "touch");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("quem só consulta não consegue arrastar", () => {
    mocks.isAdmin = false;
    renderPage();
    const coluna = colunaDe(/Marcar reunião às 09:00/);

    arrastar(coluna, 128, 224);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("abas da agenda", () => {
  beforeEach(() => {
    mocks.isAdmin = true;
    mocks.isMobile = false;
    mocks.meetings = [];
    mocks.meetingRooms = [];
    mocks.availability = [];
    mocks.setMyAvailabilityForDay.mockClear();
  });

  it("abre na semana e troca para as outras abas", () => {
    renderPage();
    expect(screen.getByText("Todas as salas")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Minha disponibilidade/ }));
    expect(screen.getByText("Meus horários livres")).toBeInTheDocument();
    // Os filtros da semana saem de cena
    expect(screen.queryByText("Todas as salas")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Combinar horário/ }));
    expect(screen.getByText("Achar horário em comum")).toBeInTheDocument();
  });

  it("marcar uma meia hora salva a disponibilidade daquele dia", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Minha disponibilidade/ }));
    fireEvent.click(screen.getAllByRole("button", { name: /^Marcar disponibilidade às 09:00/ })[0]);

    expect(mocks.setMyAvailabilityForDay).toHaveBeenCalledTimes(1);
    const [, blocos] = mocks.setMyAvailabilityForDay.mock.calls[0];
    expect(blocos).toEqual([{ startMin: 9 * 60, endMin: 9 * 60 + 30 }]);
  });

  it("clicar num bloco já marcado o remove", () => {
    mocks.availability = [
      { id: "a1", userId: "u1", weekday: 1, startMin: 9 * 60, endMin: 10 * 60 },
    ];
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Minha disponibilidade/ }));
    fireEvent.click(screen.getAllByRole("button", { name: /^Remover disponibilidade às 09:00/ })[0]);

    const [, blocos] = mocks.setMyAvailabilityForDay.mock.calls[0];
    // Tirou a primeira meia hora, sobrou 09:30–10:00
    expect(blocos).toEqual([{ startMin: 9 * 60 + 30, endMin: 10 * 60 }]);
  });
});

describe("achar horário em comum", () => {
  beforeEach(() => {
    mocks.isAdmin = true;
    mocks.isMobile = false;
    mocks.meetings = [];
    mocks.meetingRooms = [];
    // Ana (u1) e Bia (u2) livres em faixas que se cruzam das 10:00 às 12:00
    mocks.availability = [
      { id: "a1", userId: "u1", weekday: 1, startMin: 8 * 60, endMin: 12 * 60 },
      { id: "a2", userId: "u2", weekday: 1, startMin: 10 * 60, endMin: 16 * 60 },
    ];
  });

  const irParaAchar = () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Combinar horário/ }));
  };

  it("mostra a janela em que as duas estão livres", () => {
    irParaAchar();
    // Marca Ana e Bia pela lista de pessoas
    const caixas = screen.getAllByRole("checkbox");
    fireEvent.click(caixas[0]); // Ana
    fireEvent.click(caixas[1]); // Bia
    fireEvent.click(screen.getByRole("button", { name: /^Achar horário$/ }));

    expect(screen.getByText("Segunda")).toBeInTheDocument();
    expect(screen.getByText("10:00–12:00")).toBeInTheDocument();
  });

  it("avisa quando ninguém foi escolhido", () => {
    irParaAchar();
    expect(screen.getByText("Escolha ao menos uma pessoa.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Achar horário$/ })).toBeDisabled();
  });

  it("avisa sobre quem não marcou disponibilidade", () => {
    irParaAchar();
    const caixas = screen.getAllByRole("checkbox");
    fireEvent.click(caixas[0]); // Ana
    fireEvent.click(caixas[2]); // Caio, que não marcou nada
    fireEvent.click(screen.getByRole("button", { name: /^Achar horário$/ }));

    expect(screen.getByText(/Caio Reis ainda não marcou/)).toBeInTheDocument();
  });
});
