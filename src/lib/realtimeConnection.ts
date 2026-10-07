type Status = "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR";
type Channel = { subscribe: (callback: (status: Status) => void) => unknown };

/** One channel, one retry timer. removeChannel itself emits CLOSED. */
export function maintainRealtimeChannel<T extends Channel>(options: {
  create: () => T;
  remove: (channel: T) => unknown;
  onConnected: () => void;
}) {
  let disposed = false;
  let active: T | null = null;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let stable: ReturnType<typeof setTimeout> | undefined;
  let attempts = 0;

  const remove = (channel: T) => {
    // Cleanup failures must not escape into the socket's callback loop.
    try { void Promise.resolve(options.remove(channel)).catch(() => {}); } catch { /* closed */ }
  };

  const connect = () => {
    retry = undefined;
    if (disposed) return;
    const channel = options.create();
    active = channel;
    let retired = false;
    channel.subscribe(status => {
      if (disposed || retired || active !== channel) return;
      if (status === "SUBSCRIBED") {
        clearTimeout(stable);
        stable = setTimeout(() => { attempts = 0; }, 30_000);
        options.onConnected();
        return;
      }
      // Invalidate BEFORE removal: its CLOSED notification is not a new failure.
      retired = true;
      active = null;
      clearTimeout(stable);
      remove(channel);
      const delay = Math.min(1000 * 2 ** Math.min(attempts++, 6), 60_000);
      retry = setTimeout(connect, delay);
    });
  };

  connect();
  return () => {
    disposed = true;
    clearTimeout(retry);
    clearTimeout(stable);
    if (active) remove(active);
    active = null;
  };
}
