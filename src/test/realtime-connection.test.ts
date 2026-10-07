import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { maintainRealtimeChannel } from "@/lib/realtimeConnection";

type Status = "SUBSCRIBED" | "CLOSED" | "CHANNEL_ERROR" | "TIMED_OUT";
class FakeChannel {
  callback: (status: Status) => void = () => {};
  subscribe(callback: (status: Status) => void) { this.callback = callback; return this; }
  emit(status: Status) { this.callback(status); }
}

function setup() {
  const channels: FakeChannel[] = [];
  const remove = vi.fn((c: FakeChannel) => { c.emit("CLOSED"); return Promise.resolve("ok"); });
  const onConnected = vi.fn();
  const stop = maintainRealtimeChannel({
    create: () => { const c = new FakeChannel(); channels.push(c); return c; },
    remove, onConnected,
  });
  return { channels, remove, onConnected, stop };
}

describe("realtime lifecycle under prolonged failures", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("CLOSED emitted by removeChannel cannot recursively remove or schedule more retries", () => {
    const s = setup();
    s.channels[0].emit("CHANNEL_ERROR");
    s.channels[0].emit("TIMED_OUT");
    s.channels[0].emit("CLOSED");
    expect(s.remove).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(1000);
    expect(s.channels).toHaveLength(2);
    s.channels[0].emit("SUBSCRIBED");
    expect(s.onConnected).not.toHaveBeenCalled();
    s.stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("two hours of disconnects keep only one channel generation and one retry timer", () => {
    const s = setup();
    // Every connection fails after five seconds, including removal's CLOSED event.
    for (let i = 0; i < 120; i++) {
      const channel = s.channels.at(-1)!;
      channel.emit("SUBSCRIBED");
      vi.advanceTimersByTime(5000);
      channel.emit("CHANNEL_ERROR");
      expect(vi.getTimerCount()).toBe(1);
      const count = s.channels.length;
      const delay = Math.min(1000 * 2 ** Math.min(i, 6), 60_000);
      vi.advanceTimersByTime(delay - 1);
      expect(s.channels).toHaveLength(count);
      vi.advanceTimersByTime(1);
      expect(s.channels).toHaveLength(count + 1);
    }
    expect(s.remove).toHaveBeenCalledTimes(120);
    s.stop();
    vi.advanceTimersByTime(120_000);
    expect(s.channels).toHaveLength(121);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("resets backoff only after thirty seconds of continuous stability", () => {
    const s = setup();
    s.channels[0].emit("CHANNEL_ERROR");
    vi.advanceTimersByTime(1000);
    s.channels[1].emit("SUBSCRIBED");
    vi.advanceTimersByTime(30_000);
    s.channels[1].emit("CHANNEL_ERROR");
    vi.advanceTimersByTime(1000);
    expect(s.channels).toHaveLength(3);
    s.stop();
  });

  it("unmount while waiting cancels all retries, including late callbacks", () => {
    const s = setup();
    s.channels[0].emit("TIMED_OUT");
    s.stop();
    s.channels[0].emit("CLOSED");
    vi.advanceTimersByTime(3600_000);
    expect(s.channels).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
