import { describe, expect, it, vi } from "vitest";
import { isTransientAuthError, loadAuthHubSnapshot } from "@/lib/authHub";

describe("authenticated workspace hub", () => {
  it("retries a failed workspace query before accepting an empty state", async () => {
    let workspaceAttempts = 0;
    const rpc = vi.fn(async (name: string) => {
      if (name === "list_my_workspaces") {
        workspaceAttempts += 1;
        if (workspaceAttempts === 1) {
          return { data: null, error: new Error("fetch failed") };
        }
        return {
          data: [{ workspace_id: "workspace-1", name: "PROJEC" }],
          error: null,
        };
      }
      return { data: [], error: null };
    });

    const result = await loadAuthHubSnapshot({ rpc }, [0, 0]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.workspaces).toEqual([
        { workspace_id: "workspace-1", name: "PROJEC" },
      ]);
    }
    expect(workspaceAttempts).toBe(2);
  });

  it("returns an explicit error instead of converting failures into zero workspaces", async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: new Error("network unavailable"),
    }));

    const result = await loadAuthHubSnapshot({ rpc }, [0, 0, 0]);

    expect(result.ok).toBe(false);
    expect(rpc).toHaveBeenCalledTimes(9);
  });

  it("retries only errors that can be caused by an unstable connection", () => {
    expect(isTransientAuthError(new Error("Failed to fetch"))).toBe(true);
    expect(isTransientAuthError({ status: 503, message: "Unavailable" })).toBe(true);
    expect(isTransientAuthError({ status: 400, message: "Invalid login credentials" })).toBe(false);
  });
});
