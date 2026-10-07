// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseFetch, supabaseStorageKey } from "@/lib/supabaseTransport";

const upstream = "https://example.supabase.co";
const proxy = "https://usebuzzup.com.br/sb-proxy";

describe("Supabase transport", () => {
  afterEach(() => vi.useRealTimers());
  it("keeps HTTP auth headers, body and query intact through the proxy", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("{}"));
    const request = createSupabaseFetch(upstream, proxy, fetcher);
    await request(`${upstream}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST", headers: { apikey: "public-test-key", Authorization: "Bearer test" },
      body: JSON.stringify({ refresh_token: "test-token" }),
    });
    const [sent] = fetcher.mock.calls[0] as [Request];
    expect(sent.url).toBe(`${proxy}/auth/v1/token?grant_type=refresh_token`);
    expect(sent.headers.get("Authorization")).toBe("Bearer test");
    expect(sent.method).toBe("POST");
    expect(await sent.json()).toEqual({ refresh_token: "test-token" });
  });
  it("WebSocket uses upstream without changing the existing login storage key", () => {
    const client = createClient(upstream, "test-public-key", {
      auth: { storageKey: supabaseStorageKey(proxy), persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: createSupabaseFetch(upstream, proxy) },
    });
    expect(new URL(client.realtime.endpointURL()).host).toBe("example.supabase.co");
    expect(supabaseStorageKey(proxy)).toBe("sb-usebuzzup-auth-token");
    expect(supabaseStorageKey("https://buzzup0.vercel.app/sb-proxy")).toBe("sb-buzzup0-auth-token");
    expect(supabaseStorageKey(upstream)).toBe("sb-example-auth-token");
  });
  it("times out a stalled HTTP request and releases its timer", async () => {
    vi.useFakeTimers();
    const fetcher: typeof fetch = (_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
    });
    const request = createSupabaseFetch(upstream, proxy, fetcher, 1000);
    const result = request(`${upstream}/rest/v1/people`).catch(e => e);
    await vi.advanceTimersByTimeAsync(1000);
    expect((await result).name).toBe("TimeoutError");
    expect(vi.getTimerCount()).toBe(0);
  });
  it("honors caller cancellation and does not rewrite other hosts", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher = vi.fn().mockResolvedValue(new Response("{}"));
    await createSupabaseFetch(upstream, proxy, fetcher)("https://other.example/test", { signal: controller.signal });
    expect(fetcher.mock.calls[0][0].url).toBe("https://other.example/test");
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
  });
});
