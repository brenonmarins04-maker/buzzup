/** Keep HTTP on the same-origin proxy, but let the SDK open WebSockets upstream. */
export function createSupabaseFetch(
  upstreamUrl: string,
  httpUrl: string,
  fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
  timeoutMs = 25_000,
): typeof fetch {
  const upstream = new URL(upstreamUrl);
  const proxy = new URL(httpUrl);

  const paraOProxy = (endereco: string) => {
    const url = new URL(endereco);
    if (url.origin !== upstream.origin) return endereco;
    url.protocol = proxy.protocol;
    url.host = proxy.host;
    url.pathname = proxy.pathname.replace(/\/$/, "") + url.pathname;
    return url.toString();
  };

  return async (input, init) => {
    const pedido = ehRequest(input) ? input : null;
    const destino = paraOProxy(pedido ? pedido.url : String(input));
    const opcoes: RequestInit = pedido
      ? { ...(await achatar(pedido)), ...init }
      : { ...init };

    const deQuemChamou = init?.signal ?? pedido?.signal ?? null;
    const controlador = new AbortController();
    const cancelar = () => controlador.abort(deQuemChamou?.reason);
    if (deQuemChamou?.aborted) cancelar();
    else deQuemChamou?.addEventListener("abort", cancelar, { once: true });

    const relogio = setTimeout(() => controlador.abort(
      new DOMException("Request timed out", "TimeoutError"),
    ), timeoutMs);
    try {
      return await fetcher(destino, { ...opcoes, signal: controlador.signal });
    } finally {
      clearTimeout(relogio);
      deQuemChamou?.removeEventListener("abort", cancelar);
    }
  };
}

const ehRequest = (valor: unknown): valor is Request =>
  typeof Request !== "undefined" && valor instanceof Request;

/**
 * Converte um Request em opções simples, com o corpo já lido.
 *
 * `new Request(outraUrl, pedido)` parece inofensivo e era o que estava aqui,
 * mas o corpo do segundo argumento chega como stream — e mandar corpo em
 * stream só o Chromium aceita. No Safari do iPhone o corpo se perdia: o login
 * saía sem e-mail nem senha e o servidor recusava, sempre. Lendo o corpo em
 * bytes aqui, a requisição sai igual em qualquer navegador.
 */
async function achatar(pedido: Request): Promise<RequestInit> {
  const semCorpo = pedido.method === "GET" || pedido.method === "HEAD";
  return {
    method: pedido.method,
    headers: pedido.headers,
    body: semCorpo ? undefined : await pedido.arrayBuffer(),
    credentials: pedido.credentials,
    cache: pedido.cache,
    redirect: pedido.redirect,
    integrity: pedido.integrity,
  };
}

// Preserve the SDK's previous key, so changing the socket URL does not sign users out.
export function supabaseStorageKey(previousClientUrl: string) {
  return `sb-${new URL(previousClientUrl).hostname.split(".")[0]}-auth-token`;
}
