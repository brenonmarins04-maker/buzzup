/** Coalesce bursts and never overlap downloads of the same data group. */
export function createRefreshQueue(delayMs = 300) {
  type Entry = { task: () => Promise<void>; timer?: ReturnType<typeof setTimeout>; running: boolean; pending: boolean };
  const entries = new Map<string, Entry>();
  let disposed = false;
  const run = async (entry: Entry) => {
    entry.timer = undefined;
    if (disposed) return;
    entry.running = true;
    entry.pending = false;
    try { await entry.task(); } catch { /* A later event can retry; retain the visible data. */ }
    finally {
      entry.running = false;
      if (!disposed && entry.pending) entry.timer = setTimeout(() => void run(entry), delayMs);
    }
  };
  return {
    schedule(key: string, task: () => Promise<void>) {
      if (disposed) return;
      let entry = entries.get(key);
      if (!entry) { entry = { task, running: false, pending: false }; entries.set(key, entry); }
      entry.task = task;
      if (entry.running) { entry.pending = true; return; }
      clearTimeout(entry.timer);
      entry.timer = setTimeout(() => void run(entry), delayMs);
    },
    dispose() {
      disposed = true;
      entries.forEach(entry => clearTimeout(entry.timer));
      entries.clear();
    },
  };
}
