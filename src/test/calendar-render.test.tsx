import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ── Mock data representativo de um workspace real ──────────────────────────
const team = { id: "abc-DEF-123", name: "Time de Vendas", memberIds: ["p1"] };
const people = [
  { id: "p1", name: "Julia Calixto", nickname: null, area: "mercado", areas: ["mercado"], userId: "u1", leaderArea: null, leaderAreas: [] },
];
const parkingItems = [
  { id: "pk1", area: "mercado", personId: "p1", title: "Ideia mercado", description: "", date: "2026-07-02", position: 0, status: "in-progress", points: 1 },
  // Área de time em MAIÚSCULO — dado legado
  { id: "pk2", area: "TEAM_abc-DEF-123", personId: "p1", title: "Ideia do time", description: "", date: "2026-07-03", position: 0, status: "in-progress", points: 1 },
  { id: "pk3", area: "team_abc-DEF-123", personId: null, title: "Sem data", description: "", date: "", position: 0, status: "in-progress", points: 1 },
];
const tasks = [
  { id: "t1", title: "Task 1", description: "", team: "", teamId: null, responsible: [], deadline: "2026-07-02", status: "in-progress", checklist: [], points: 1, area: "projetos" },
];
const posts = [
  { id: "po1", title: "Post 1", copy: "", channel: "", category: "", date: "2026-07-02", time: "10:00", status: "not-started", responsible: [], teamId: null, link: "", media_url: "" },
];
const events = [{ id: "e1", title: "Evento 1", date: "2026-07-02", type: "Reunião", description: "", teamId: null }];
const eventTypes = [{ id: "et1", name: "Reunião", color: "#123456" }];

const noop = () => {};
const dataValue: any = {
  tasks, posts, events, eventTypes, parkingItems, teams: [team], people,
  channels: [], categories: [], projects: [], notifications: [],
  updateTask: noop, updatePost: noop, updateEvent: noop,
  deleteTask: noop, deletePost: noop, deleteEvent: noop,
  addParkingItem: noop, updateParkingItem: noop, deleteParkingItem: noop,
  addEvent: noop, addEventType: noop, updateEventType: noop, deleteEventType: noop,
  addTask: noop, addPost: noop,
};

vi.mock("@/contexts/DataContext", () => ({
  useData: () => dataValue,
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isAdmin: true, isOwner: true, isLeader: false, role: "owner", user: { id: "u1", email: "a@b.com" } }),
}));
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

import CalendarPage from "@/pages/CalendarPage";

describe("CalendarPage render", () => {
  it("renderiza sem lançar erro", () => {
    expect(() =>
      render(
        <MemoryRouter>
          <CalendarPage />
        </MemoryRouter>
      )
    ).not.toThrow();
  });
});
