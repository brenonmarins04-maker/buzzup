import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataProvider, useData } from "@/contexts/DataContext";

type Result = { data: Record<string, unknown>[] | null; error: unknown };
type Payload = { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> };
const mock = vi.hoisted(() => ({
  workspaceId: "workspace-a",
  query: vi.fn(),
  channels: [] as {
    handlers: Map<string, (payload: Payload) => void>;
    on: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
    status?: (status: string) => void;
  }[],
  removeChannel: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-a" }, workspaceId: mock.workspaceId, isAdmin: false, isOwner: false }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: () => Promise.resolve({ data: null, error: null }),
    from: (table: string) => {
      let workspace = mock.workspaceId;
      const builder = {
        select: () => builder,
        eq: (column: string, value: string) => { if (column === "workspace_id") workspace = value; return builder; },
        or: () => builder, order: () => builder, gt: () => builder, limit: () => builder,
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        upsert: () => Promise.resolve({ data: null, error: null }),
        then: (resolve: (r: Result) => void, reject: (e: unknown) => void) =>
          Promise.resolve(mock.query(table, workspace)).then(resolve, reject),
      };
      return builder;
    },
    channel: () => {
      const channel: typeof mock.channels[number] = {
        handlers: new Map(),
        on: vi.fn((_event, config, callback) => { channel.handlers.set(config.table, callback); return channel; }),
        subscribe: vi.fn(callback => { channel.status = callback; return channel; }),
      };
      mock.channels.push(channel);
      return channel;
    },
    removeChannel: mock.removeChannel,
  },
}));

let latest: ReturnType<typeof useData>;
function Probe() { latest = useData(); return null; }
function fixture(table: string, workspace: string): Result {
  if (table === "people") return { data: [{ id: `${workspace}-person`, name: workspace, area: "mercado" }], error: null };
  if (table === "parking_items") return { data: [{ id: `${workspace}-demand`, person_id: `${workspace}-person`, area: "mercado", title: "Existing demand" }], error: null };
  if (table === "user_daily_logins") return { data: [{ id: "already-logged" }], error: null };
  return { data: [], error: null };
}
async function advance(ms = 300) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
function emit(table: string, payload: Partial<Payload> = {}) {
  mock.channels.at(-1)!.handlers.get(table)!({ eventType: "UPDATE", new: {}, old: {}, ...payload });
}

describe("DataProvider realtime resilience", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mock.workspaceId = "workspace-a";
    mock.channels.length = 0;
    mock.query.mockReset().mockImplementation(fixture);
    mock.removeChannel.mockReset().mockImplementation(channel => { channel.status?.("CLOSED"); return Promise.resolve("ok"); });
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("retains people and their demands after a failed refresh and recovers on the next event", async () => {
    render(<DataProvider><Probe /></DataProvider>);
    await advance(0);
    expect(latest.people).toHaveLength(1);
    expect(latest.parkingItems[0].personId).toBe("workspace-a-person");
    mock.query.mockImplementation((table, workspace) => table === "people"
      ? { data: null, error: new Error("offline") } : fixture(table, workspace));
    act(() => emit("people"));
    await advance();
    expect(latest.people).toHaveLength(1);
    expect(latest.parkingItems).toHaveLength(1);
    mock.query.mockImplementation((table, workspace) => table === "people"
      ? { data: [{ id: "workspace-a-person", name: "Updated name" }], error: null } : fixture(table, workspace));
    act(() => emit("people"));
    await advance();
    expect(latest.people[0].name).toBe("Updated name");
    expect(latest.parkingItems[0].personId).toBe("workspace-a-person");
  });

  it("ignores a delayed response from a workspace that was left", async () => {
    const view = render(<DataProvider><Probe /></DataProvider>);
    await advance(0);
    let finish!: (r: Result) => void;
    mock.query.mockImplementation((table, workspace) => table === "people" && workspace === "workspace-a"
      ? new Promise<Result>(resolve => { finish = resolve; }) : fixture(table, workspace));
    act(() => emit("people"));
    await advance();
    mock.workspaceId = "workspace-b";
    view.rerender(<DataProvider><Probe /></DataProvider>);
    await advance(0);
    expect(latest.people[0].id).toBe("workspace-b-person");
    await act(async () => { finish(fixture("people", "workspace-a")); });
    expect(latest.people[0].id).toBe("workspace-b-person");
    expect(latest.parkingItems[0].personId).toBe("workspace-b-person");
    expect(mock.removeChannel).toHaveBeenCalledTimes(1);
  });

  it("coalesces bursts and ignores events belonging to another workspace", async () => {
    render(<DataProvider><Probe /></DataProvider>);
    await advance(0);
    mock.query.mockClear();
    act(() => {
      for (let i = 0; i < 100; i++) emit("people");
      emit("calendar_items", { new: { workspace_id: "workspace-b" } });
    });
    await advance();
    expect(mock.query.mock.calls.filter(([table]) => table === "people")).toHaveLength(1);
    expect(mock.query.mock.calls.filter(([table]) => table === "calendar_items")).toHaveLength(0);
  });

  it("applies deletes with only a primary key and releases the channel on unmount", async () => {
    const view = render(<DataProvider><Probe /></DataProvider>);
    await advance(0);
    act(() => emit("parking_items", { eventType: "DELETE", old: { id: "workspace-a-demand" } }));
    expect(latest.parkingItems).toHaveLength(0);
    view.unmount();
    await advance(120_000);
    expect(mock.channels).toHaveLength(1);
    expect(mock.removeChannel).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
