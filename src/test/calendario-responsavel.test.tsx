import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

/**
 * Na pílula do calendário, o status fica em cima e o responsável embaixo.
 *
 * Olhando o mês, dava para ver que uma demanda estava atrasada mas não que
 * ela não tinha dono — e demanda sem dono é a que ninguém vai fazer. Os dois
 * sinais agora ficam na mesma coluna, um sob o outro.
 *
 * Também confere a recomendação de responsável: ela conta as demandas da
 * pessoa no workspace inteiro, não só na área onde a demanda está nascendo.
 */

const team = { id: "abc-DEF-123", name: "Time de Vendas", memberIds: ["p1", "p2"] };
const people = [
  { id: "p1", name: "Luisa Prado", nickname: null, area: "mercado", areas: ["mercado"], userId: "u1", leaderArea: null, leaderAreas: [] },
  { id: "p2", name: "Pedro Alves", nickname: null, area: "mercado", areas: ["mercado"], userId: "u2", leaderArea: null, leaderAreas: [] },
];

// Luisa tem 3 demandas em OUTRA área (diversidade) e nenhuma no time.
// Pedro tem uma só. O recomendado para o time tem de ser o Pedro.
const parkingItems = [
  { id: "d1", area: "area_diversidade", personId: "p1", title: "Painel", description: "", date: "", position: 0, status: "in-progress", points: 1 },
  { id: "d2", area: "area_diversidade", personId: "p1", title: "Roda de conversa", description: "", date: "", position: 1, status: "in-progress", points: 1 },
  { id: "d3", area: "area_diversidade", personId: "p1", title: "Relatório", description: "", date: "", position: 2, status: "in-progress", points: 1 },
  { id: "d4", area: "mercado", personId: "p2", title: "Com dono", description: "", date: "2026-07-02", position: 0, status: "in-progress", points: 1 },
  { id: "d5", area: "mercado", personId: null, title: "Sem dono", description: "", date: "2026-07-02", position: 1, status: "in-progress", points: 1 },
];

const mobileMode = vi.hoisted(() => ({ value: false }));
const espioes = vi.hoisted(() => ({ addParkingItem: vi.fn() }));

const noop = () => {};
const dataValue = {
  tasks: [], posts: [], parkingItems, teams: [team], people,
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

describe("sinal de responsável na pílula", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T12:00:00-03:00"));
    mobileMode.value = false;
    espioes.addParkingItem.mockReset();
    localStorage.clear();
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("quem não tem dono recebe o aviso, quem tem mostra o nome", () => {
    montar();
    expect(screen.getAllByTitle("Sem responsável").length).toBeGreaterThan(0);
    expect(screen.getAllByTitle("Responsável: Pedro Alves").length).toBeGreaterThan(0);
  });

  it("o sinal de status continua lá, junto do de responsável", () => {
    montar();
    // 2 de julho é futuro em relação a 1/7 → "Em andamento"
    expect(screen.getAllByTitle("Em andamento").length).toBe(2);
  });

  it("post não ganha sinal de responsável — ali não faria sentido", () => {
    // Post é publicação, não demanda: não tem dono no mesmo sentido.
    dataValue.posts = [{
      id: "po1", title: "Post no mesmo dia", copy: "", channel: "", category: "",
      date: "2026-07-02", time: "10:00", status: "not-started",
      responsible: [], teamId: null, link: "", media_url: "",
    }] as never;
    montar();

    const pilula = screen.getByText("Post no mesmo dia").closest("div[class*='group/pill']")!;
    expect(within(pilula as HTMLElement).queryByTitle("Sem responsável")).not.toBeInTheDocument();
    expect(within(pilula as HTMLElement).queryByTitle(/^Responsável: /)).not.toBeInTheDocument();

    dataValue.posts = [];
  });

  it("no celular, o popup do dia diz na letra quem é o responsável", () => {
    mobileMode.value = true;
    montar();
    fireEvent.click(screen.getByRole("button", { name: /^2 de julho/ }));

    const popup = screen.getByRole("dialog");
    expect(within(popup).getByText("Sem responsável")).toBeInTheDocument();
    expect(within(popup).getByText("Pedro Alves")).toBeInTheDocument();
  });
});

describe("responsável recomendado", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T12:00:00-03:00"));
    mobileMode.value = false;
    espioes.addParkingItem.mockReset();
    localStorage.clear();
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("conta as demandas de outras áreas e recomenda quem tem menos", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Time de Vendas" }));
    fireEvent.click(screen.getAllByTitle("Nova demanda em Time de Vendas")[9]);

    const modal = screen.getByRole("dialog");

    // Luisa: 3 demandas, todas no time de Diversidade — e mesmo assim contam
    const luisa = within(modal).getByRole("button", { name: /Luisa Prado/ });
    expect(luisa).toHaveAttribute("title", expect.stringContaining("3 demandas em aberto"));
    expect(within(luisa).queryByText("recomendado")).not.toBeInTheDocument();

    // Pedro: 1 demanda — é o mais livre
    const pedro = within(modal).getByRole("button", { name: /Pedro Alves/ });
    expect(within(pedro).getByText("recomendado")).toBeInTheDocument();
    expect(pedro).toHaveAttribute("title", expect.stringContaining("é quem tem menos"));
  });

  it("dá para escolher o recomendado e a demanda sai com ele", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Time de Vendas" }));
    fireEvent.click(screen.getAllByTitle("Nova demanda em Time de Vendas")[9]);

    const modal = screen.getByRole("dialog");
    fireEvent.change(within(modal).getByPlaceholderText("Descreva a demanda"), {
      target: { value: "Fechar proposta" },
    });
    fireEvent.click(within(modal).getByRole("button", { name: /Pedro Alves/ }));
    fireEvent.click(within(modal).getByRole("button", { name: "Salvar" }));

    expect(espioes.addParkingItem).toHaveBeenCalledWith(
      "team_abc-DEF-123", "Fechar proposta", "2026-07-07", "", 1,
    );
  });
});
