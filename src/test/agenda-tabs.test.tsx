import { createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AgendaPage from "@/pages/AgendaPage";
import type { Meeting, MeetingRoom } from "@/lib/agenda";
import type { UnavailableSlot } from "@/lib/unavailability";
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
  unavailability: [] as UnavailableSlot[],
  setMyUnavailabilityForDay: vi.fn(),
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
    unavailability: mocks.unavailability,
    setMyUnavailabilityForDay: mocks.setMyUnavailabilityForDay,
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

describe("abas da agenda", () => {
  beforeEach(() => {
    mocks.isAdmin = true;
    mocks.isMobile = false;
    mocks.meetings = [];
    mocks.meetingRooms = [];
    mocks.unavailability = [];
    mocks.setMyUnavailabilityForDay.mockClear();
  });

  it("abre na semana e troca para as outras abas", () => {
    renderPage();
    expect(screen.getByText("Todas as salas")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Meus horários/ }));
    expect(screen.getByText("Meus horários ocupados")).toBeInTheDocument();
    // Os filtros da semana saem de cena
    expect(screen.queryByText("Todas as salas")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Combinar horário/ }));
    expect(screen.getByText("Achar horário em comum")).toBeInTheDocument();
  });

  it("clicar numa meia hora a marca como ocupada", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Meus horários/ }));
    fireEvent.click(screen.getAllByRole("button", { name: /^Ocupar 09:00/ })[0]);

    expect(mocks.setMyUnavailabilityForDay).toHaveBeenCalledTimes(1);
    const [, blocos] = mocks.setMyUnavailabilityForDay.mock.calls[0];
    expect(blocos).toEqual([{ startMin: 9 * 60, endMin: 9 * 60 + 30 }]);
  });

  it("clicar num bloco já ocupado libera aquela meia hora", () => {
    mocks.unavailability = [
      { id: "a1", userId: "u1", weekday: 1, startMin: 9 * 60, endMin: 10 * 60 },
    ];
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Meus horários/ }));
    fireEvent.click(screen.getAllByRole("button", { name: /^Liberar 09:00/ })[0]);

    const [, blocos] = mocks.setMyUnavailabilityForDay.mock.calls[0];
    // Liberou a primeira meia hora, continua ocupado das 09:30 às 10:00
    expect(blocos).toEqual([{ startMin: 9 * 60 + 30, endMin: 10 * 60 }]);
  });
});

describe("achar horário em comum", () => {
  beforeEach(() => {
    mocks.isAdmin = true;
    mocks.isMobile = false;
    mocks.meetings = [];
    mocks.meetingRooms = [];
    // Ana (u1) ocupada até as 10:00 e Bia (u2) a partir das 12:00:
    // dentro do limite padrão (08:00–18:00) sobra 10:00–12:00 para as duas
    mocks.unavailability = [
      { id: "a1", userId: "u1", weekday: 1, startMin: 8 * 60, endMin: 10 * 60 },
      { id: "a2", userId: "u2", weekday: 1, startMin: 12 * 60, endMin: 18 * 60 },
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

  it("avisa sobre quem não marcou horários ocupados", () => {
    irParaAchar();
    const caixas = screen.getAllByRole("checkbox");
    fireEvent.click(caixas[0]); // Ana
    fireEvent.click(caixas[2]); // Caio, que não marcou nada
    fireEvent.click(screen.getByRole("button", { name: /^Achar horário$/ }));

    expect(screen.getByText(/Caio Reis ainda não marcou horários ocupados/)).toBeInTheDocument();
  });

  it("mostra o nome da pessoa, não o apelido da gamificação", () => {
    irParaAchar();
    // Ana Souza tem apelido "Ana" na gamificação
    expect(screen.getByText("Ana Souza")).toBeInTheDocument();
    expect(screen.queryByText("Ana")).not.toBeInTheDocument();
  });

  it("o chip do time marca e desmarca o grupo inteiro", () => {
    irParaAchar();
    const chip = screen.getByRole("button", { name: "Time Alpha" });
    expect(chip).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
    // Time Alpha = Caio
    expect(screen.getByText(/Quem precisa estar \(1\)/)).toBeInTheDocument();

    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText(/Quem precisa estar \(/)).not.toBeInTheDocument();
  });

  it("o chip fica marcado quando o grupo já está todo selecionado", () => {
    irParaAchar();
    // Marca o Caio na mão; o chip do Time Alpha deve refletir isso
    fireEvent.click(screen.getAllByRole("checkbox")[2]);
    expect(screen.getByRole("button", { name: "Time Alpha" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("marcar horários ocupados com o dedo", () => {
  beforeEach(() => {
    mocks.isAdmin = true;
    mocks.isMobile = true;
    mocks.meetings = [];
    mocks.meetingRooms = [];
    mocks.unavailability = [];
    mocks.setMyUnavailabilityForDay.mockClear();
  });

  /**
   * O jsdom não implementa PointerEvent: clientY e pointerType não sobrevivem
   * ao fireEvent comum, é preciso cravá-los no evento.
   */
  const ponteiro = (
    tipo: "pointerDown" | "pointerMove" | "pointerUp",
    el: HTMLElement,
    { clientY, pointerType }: { clientY: number; pointerType: string },
  ) => {
    const ev = createEvent[tipo](el, { bubbles: true });
    Object.defineProperty(ev, "clientY", { value: clientY });
    Object.defineProperty(ev, "button", { value: 0 });
    Object.defineProperty(ev, "pointerId", { value: 1 });
    Object.defineProperty(ev, "pointerType", { value: pointerType });
    fireEvent(el, ev);
  };

  const arrastar = (el: HTMLElement, de: number, ate: number, pointerType: string) => {
    ponteiro("pointerDown", el, { clientY: de, pointerType });
    ponteiro("pointerMove", el, { clientY: ate, pointerType });
    ponteiro("pointerUp", el, { clientY: ate, pointerType });
  };

  const abrirAba = () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Meus horários/ }));
    fireEvent.click(screen.getByRole("button", { name: "Seg" }));
  };

  const coluna = () =>
    screen.getAllByRole("button", { name: /^Ocupar 09:00/ })[0].parentElement as HTMLElement;

  it("o botão de arrastar com o dedo aparece no celular", () => {
    abrirAba();
    const botao = screen.getByRole("button", { name: /Arrastar o dedo/ });
    expect(botao).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(botao);
    expect(screen.getByRole("button", { name: /Arrastando/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("com o modo ligado, arrastar o dedo marca a faixa toda", () => {
    abrirAba();
    fireEvent.click(screen.getByRole("button", { name: /Arrastar o dedo/ }));

    // A grade começa às 06:00 e cada hora tem 64px: 192px = 09:00, 288px = 10:30
    arrastar(coluna(), 192, 288, "touch");

    expect(mocks.setMyUnavailabilityForDay).toHaveBeenCalledTimes(1);
    const [dia, blocos] = mocks.setMyUnavailabilityForDay.mock.calls[0];
    expect(dia).toBe(1);
    expect(blocos).toEqual([{ startMin: 9 * 60, endMin: 11 * 60 }]);
  });

  it("com o modo desligado, o dedo não pinta — o gesto é rolagem", () => {
    abrirAba();
    arrastar(coluna(), 192, 288, "touch");
    expect(mocks.setMyUnavailabilityForDay).not.toHaveBeenCalled();
  });

  it("o modo ligado troca o touch-action da coluna", () => {
    abrirAba();
    expect(coluna().style.touchAction).toBe("pan-y");
    fireEvent.click(screen.getByRole("button", { name: /Arrastar o dedo/ }));
    expect(coluna().style.touchAction).toBe("none");
  });

  it("arrastar sobre um bloco já ocupado libera a faixa", () => {
    mocks.unavailability = [
      { id: "a1", userId: "u1", weekday: 1, startMin: 8 * 60, endMin: 12 * 60 },
    ];
    abrirAba();
    fireEvent.click(screen.getByRole("button", { name: /Arrastar o dedo/ }));

    const col = screen.getAllByRole("button", { name: /^Liberar 09:00/ })[0].parentElement as HTMLElement;
    arrastar(col, 192, 288, "touch");

    const [, blocos] = mocks.setMyUnavailabilityForDay.mock.calls[0];
    // Tirou 09:00–11:00 do bloco 08:00–12:00
    expect(blocos).toEqual([
      { startMin: 8 * 60, endMin: 9 * 60 },
      { startMin: 11 * 60, endMin: 12 * 60 },
    ]);
  });

  it("o mouse continua arrastando sem precisar do modo", () => {
    mocks.isMobile = false;
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Meus horários/ }));
    // Sem botão de modo no computador
    expect(screen.queryByRole("button", { name: /Arrastar o dedo/ })).not.toBeInTheDocument();

    arrastar(coluna(), 192, 288, "mouse");
    const [, blocos] = mocks.setMyUnavailabilityForDay.mock.calls[0];
    expect(blocos).toEqual([{ startMin: 9 * 60, endMin: 11 * 60 }]);
  });
});
