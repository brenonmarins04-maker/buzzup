export type HubRpcResponse = {
  data: unknown;
  error: unknown;
};

export type HubRpcClient = {
  rpc: (name: string) => PromiseLike<HubRpcResponse>;
};

export type AuthHubSnapshot = {
  workspaces: unknown[];
  trashedWorkspaces: unknown[];
  joinRequests: unknown[];
  trashError: unknown;
  joinRequestsError: unknown;
};

export type AuthHubResult =
  | { ok: true; snapshot: AuthHubSnapshot }
  | { ok: false; error: unknown };

const wait = (delayMs: number) =>
  new Promise<void>((resolve) => globalThis.setTimeout(resolve, delayMs));

const rows = (value: unknown) => (Array.isArray(value) ? value : []);

export function isTransientAuthError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const candidate = error as {
    message?: string;
    status?: number;
    code?: string;
  };
  const message = (candidate.message || "").toLowerCase();

  return candidate.status === 0
    || (typeof candidate.status === "number" && candidate.status >= 500)
    || candidate.code === "request_timeout"
    || message.includes("fetch")
    || message.includes("network")
    || message.includes("timeout")
    || message.includes("temporarily");
}

export async function loadAuthHubSnapshot(
  client: HubRpcClient,
  retryDelays = [0, 300, 900],
): Promise<AuthHubResult> {
  let lastError: unknown = new Error("Workspace query failed");

  for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
    if (retryDelays[attempt] > 0) await wait(retryDelays[attempt]);

    try {
      const [workspaces, trash, requests] = await Promise.all([
        client.rpc("list_my_workspaces"),
        client.rpc("list_my_trashed_workspaces"),
        client.rpc("list_my_join_requests"),
      ]);

      if (!workspaces.error) {
        return {
          ok: true,
          snapshot: {
            workspaces: rows(workspaces.data),
            trashedWorkspaces: rows(trash.data),
            joinRequests: rows(requests.data),
            trashError: trash.error,
            joinRequestsError: requests.error,
          },
        };
      }

      lastError = workspaces.error;
    } catch (error) {
      lastError = error;
    }
  }

  return { ok: false, error: lastError };
}
