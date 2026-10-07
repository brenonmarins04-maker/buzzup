import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRefreshQueue } from "@/lib/refreshQueue";

describe("bounded background refreshes", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it("coalesces bursts and allows only one trailing refresh while a download is pending", async () => {
    const queue = createRefreshQueue();
    let finish!: () => void;
    const task = vi.fn(() => new Promise<void>(r => { finish = r; }));
    for (let i = 0; i < 100; i++) queue.schedule("people", task);
    await vi.advanceTimersByTimeAsync(300);
    expect(task).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 100; i++) queue.schedule("people", task);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(task).toHaveBeenCalledTimes(1);
    finish();
    await vi.advanceTimersByTimeAsync(300);
    expect(task).toHaveBeenCalledTimes(2);
    finish();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(task).toHaveBeenCalledTimes(2);
    queue.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("a failed request does not leave the queue locked", async () => {
    const queue = createRefreshQueue();
    const task = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    queue.schedule("tasks", task);
    await vi.advanceTimersByTimeAsync(300);
    queue.schedule("tasks", task);
    await vi.advanceTimersByTimeAsync(300);
    expect(task).toHaveBeenCalledTimes(2);
    queue.dispose();
  });
  it("workspace switch drops queued work and follow-up requests", async () => {
    const queue = createRefreshQueue();
    let finish!: () => void;
    const task = vi.fn(() => new Promise<void>(r => { finish = r; }));
    queue.schedule("tasks", task);
    await vi.advanceTimersByTimeAsync(300);
    queue.schedule("tasks", task);
    queue.schedule("people", task);
    queue.dispose();
    finish();
    queue.schedule("tasks", task);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(task).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
