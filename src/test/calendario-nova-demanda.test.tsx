import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

/**
 * O "+" de um dia cria DEMANDA, não evento.
 *
 * Antes ele abria o modal de evento — outro tipo de item, com tipos próprios
 * (Reunião, Palestra...), que não ia para time nenhum nem valia ponto. Com um
 * time escolhido no filtro, a demanda tem de nascer nesse time e nesse dia.
 */

const team = { id: "abc-DEF-123", name: "Time de Vendas", memberIds: ["p1"] };
const people = [
  { id: "p1", name: "Julia Calixto", nickname: null, area: "mercado", areas: ["mercado"], userId: "u1", leaderArea: null, leaderAreas: [] },
];

const mobileMode = vi.hoisted(() => ({ value: false }));
const espioes = vi.hoisted(() => ({ addParkingItem: vi.fn() }));

const noop = () => {};
const dataValue = {
  tasks: [], posts: [], parkingItems: [], teams: [team], people,
  channels: [], categories: [], projects: [], notifications: [],
  updateTask: noop, updatePost: noop, deleteTask: noop, deletePost: noop,
  addParkingItem: espioes.addParkingItem,
  updateParkingItem: noop, deleteParkingItem: noop,
  addTask: noop, addPost: noop,
};

vi.mock("@/contexts/DataContext", () => ({ useData: () => dataValue }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isAdmin: true, isOwner: true, isLeader: false, role: "owner", activeWorkspaceId: "w1", user: { id: "u1", email: "a@b.com" } }),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => mobileMode.value }));
vi.mock("@/hooks/useDemandPoints", () => ({
  useDemandPoints: () => ({ points: [1, 2, 3], save: noop, saving: false }),
}));

import CalendarPage from "@/pages/CalendarPage";

const montar = () => render(<MemoryRouter><CalendarPage /></MemoryRouter>);

describe("o + de um dia abre uma demanda", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T12:00:00-03:00"));
    mobileMode.value = false;
    espioes.addParkingItem.mockReset();
    localStorage.clear();
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("não existe mais botão de evento no calendário", () => {
    montar();
    expect(screen.queryByTitle("Novo evento")).not.toBeInTheDocument();
    expect(screen.getAllByTitle("Nova demanda").length).toBeGreaterThan(0);
  });

  it("com um time escolhido, o + daquele dia já aponta para o time", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Time de Vendas" }));

    // O título do "+" é o que a pessoa lê antes de clicar
    expect(screen.getAllByTitle("Nova demanda em Time de Vendas").length).toBeGreaterThan(0);
  });

  it("a demanda criada pelo + vai para o time e para o dia clicado", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Time de Vendas" }));
    fireEvent.click(screen.getAllByTitle("Nova demanda em Time de Vendas")[9]);

    const modal = screen.getByRole("dialog");
    expect(within(modal).getByText("Nova demanda")).toBeInTheDocument();

    // O dia clicado já vem preenchido. A grade começa no domingo anterior
    // (28/06), então o 10º quadradinho é 7 de julho.
    const data = within(modal).getByDisplayValue(/^2026-07-/) as HTMLInputElement;
    expect(data.value).toBe("2026-07-07");

    // Só os membros do time aparecem como responsáveis — prova de que a área
    // selecionada é mesmo o time, e não uma área qualquer.
    expect(within(modal).getByRole("button", { name: "Julia Calixto" })).toBeInTheDocument();

    fireEvent.change(within(modal).getByPlaceholderText("Descreva a demanda"), {
      target: { value: "Fechar proposta" },
    });
    fireEvent.click(within(modal).getByRole("button", { name: "Salvar" }));

    expect(espioes.addParkingItem).toHaveBeenCalledWith(
      "team_abc-DEF-123", "Fechar proposta", "2026-07-07", "", 1,
    );
  });

  it("sem filtro, o + abre a demanda sem área escolhida", () => {
    montar();
    fireEvent.click(screen.getAllByTitle("Nova demanda")[9]);

    const modal = screen.getByRole("dialog");
    expect(within(modal).getByText("Selecione a área primeiro")).toBeInTheDocument();
  });

  it("no celular, o dia vazio também deixa criar", () => {
    mobileMode.value = true;
    montar();
    fireEvent.click(screen.getByRole("button", { name: /Filtros/ }));
    fireEvent.click(screen.getByRole("button", { name: "Time de Vendas" }));

    // 10 de julho não tem nada agendado — ainda assim o dia abre
    fireEvent.click(screen.getByRole("button", { name: /10 de julho/ }));

    expect(screen.getByText("Nada agendado neste dia.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nova demanda em Time de Vendas" })).toBeInTheDocument();
  });
});
