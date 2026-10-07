// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseFetch, supabaseStorageKey } from "@/lib/supabaseTransport";

const upstream = "https://example.supabase.co";
const proxy = "https://usebuzzup.com.br/sb-proxy";

const corpoEnviado = async (chamada: [string, RequestInit]) => {
  const { body } = chamada[1];
  if (typeof body === "string") return body;
  return new TextDecoder().decode(body as ArrayBuffer);
};

describe("Supabase transport", () => {
  afterEach(() => vi.useRealTimers());
  it("keeps HTTP auth headers, body and query intact through the proxy", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("{}"));
    const request = createSupabaseFetch(upstream, proxy, fetcher);
    await request(`${upstream}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST", headers: { apikey: "public-test-key", Authorization: "Bearer test" },
      body: JSON.stringify({ refresh_token: "test-token" }),
    });
    const [destino, opcoes] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(destino).toBe(`${proxy}/auth/v1/token?grant_type=refresh_token`);
    expect(new Headers(opcoes.headers).get("Authorization")).toBe("Bearer test");
    expect(opcoes.method).toBe("POST");
    expect(JSON.parse(await corpoEnviado([destino, opcoes]))).toEqual({ refresh_token: "test-token" });
  });

  // O login do celular quebrava aqui: o corpo virava stream e sumia fora do
  // Chromium. Agora o corpo tem de chegar inteiro mesmo entrando como Request.
  it("carries the body when the caller hands over a Request object", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("{}"));
    const request = createSupabaseFetch(upstream, proxy, fetcher);
    await request(new Request(`${upstream}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: "public-test-key" },
      body: JSON.stringify({ email: "pessoa@exemplo.com", password: "segredo" }),
    }));
    const [destino, opcoes] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(destino).toBe(`${proxy}/auth/v1/token?grant_type=password`);
    expect(opcoes.method).toBe("POST");
    expect(opcoes.body).toBeInstanceOf(ArrayBuffer);
    expect(JSON.parse(await corpoEnviado([destino, opcoes])))
      .toEqual({ email: "pessoa@exemplo.com", password: "segredo" });
  });

  it("never sends a body on a GET handed over as a Request", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("{}"));
    const request = createSupabaseFetch(upstream, proxy, fetcher);
    await request(new Request(`${upstream}/rest/v1/people?select=*`));
    const [destino, opcoes] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(destino).toBe(`${proxy}/rest/v1/people?select=*`);
    expect(opcoes.body).toBeUndefined();
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
    expect(fetcher.mock.calls[0][0]).toBe("https://other.example/test");
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
  });
});
