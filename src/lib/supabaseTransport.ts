/** Keep HTTP on the same-origin proxy, but let the SDK open WebSockets upstream. */
export function createSupabaseFetch(
  upstreamUrl: string,
  httpUrl: string,
  fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
  timeoutMs = 25_000,
): typeof fetch {
  const upstream = new URL(upstreamUrl);
  const proxy = new URL(httpUrl);
  return async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.origin === upstream.origin) {
      url.protocol = proxy.protocol;
      url.host = proxy.host;
      url.pathname = proxy.pathname.replace(/\/$/, "") + url.pathname;
    }
    const controller = new AbortController();
    const abort = () => controller.abort(request.signal.reason);
    if (request.signal.aborted) abort();
    else request.signal.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => controller.abort(
      new DOMException("Request timed out", "TimeoutError"),
    ), timeoutMs);
    try {
      return await fetcher(new Request(url, request), { signal: controller.signal });
    } finally {
      clearTimeout(timer);
      request.signal.removeEventListener("abort", abort);
    }
  };
}

// Preserve the SDK's previous key, so changing the socket URL does not sign users out.
export function supabaseStorageKey(previousClientUrl: string) {
  return `sb-${new URL(previousClientUrl).hostname.split(".")[0]}-auth-token`;
}
