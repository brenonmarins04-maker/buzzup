import type { Session } from "@supabase/supabase-js";
import {
  RECOVERY_MAX_AGE_MS,
  RECOVERY_MAX_USES,
  clearStoredRecoverySession,
  consumeRecoveryResume,
  registerRecoveryLinkUse,
} from "@/lib/recoverySession";

function session(now: number, refreshToken = "refresh-1") {
  return {
    access_token: "access-1",
    refresh_token: refreshToken,
    expires_at: Math.floor((now + RECOVERY_MAX_AGE_MS) / 1000),
    user: { id: "user-1" },
  } as Session;
}

describe("recovery session resume", () => {
  beforeEach(() => {
    clearStoredRecoverySession();
  });

  it("allows the recovery page to be used at most ten times", () => {
    const now = 1_800_000_000_000;
    const first = registerRecoveryLinkUse(session(now), "source-1", now);
    expect(first).toMatchObject({ status: "available", uses: 1 });

    for (let use = 2; use <= RECOVERY_MAX_USES; use += 1) {
      expect(consumeRecoveryResume(now + use)).toMatchObject({
        status: "available",
        uses: use,
      });
    }

    expect(consumeRecoveryResume(now + 20)).toEqual({ status: "exhausted" });
  });

  it("expires the browser resume after one hour", () => {
    const now = 1_800_000_000_000;
    registerRecoveryLinkUse(session(now), "source-1", now);

    expect(consumeRecoveryResume(now + RECOVERY_MAX_AGE_MS + 1)).toEqual({
      status: "expired",
    });
  });

  it("starts a fresh counter for a newly issued recovery link", () => {
    const now = 1_800_000_000_000;
    registerRecoveryLinkUse(session(now), "source-1", now);
    consumeRecoveryResume(now + 1);

    const next = registerRecoveryLinkUse(
      session(now + 2, "refresh-2"),
      "source-2",
      now + 2,
    );
    expect(next).toMatchObject({ status: "available", uses: 1 });
  });
});
