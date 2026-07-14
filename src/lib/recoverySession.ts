import type { Session } from "@supabase/supabase-js";

export const RECOVERY_MAX_USES = 10;
export const RECOVERY_MAX_AGE_MS = 60 * 60 * 1000;

const RECOVERY_STORAGE_KEY = "buzzup.password-recovery.v1";

type StoredRecoverySession = {
  version: 1;
  accessToken: string;
  refreshToken: string;
  sourceRefreshToken: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
  uses: number;
};

export type RecoveryResumeResult =
  | {
      status: "available";
      accessToken: string;
      refreshToken: string;
      uses: number;
      usesRemaining: number;
    }
  | { status: "missing" | "expired" | "exhausted" };

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function removeStoredRecovery() {
  try {
    storage()?.removeItem(RECOVERY_STORAGE_KEY);
  } catch {
    // Recovery still works in the current tab when browser storage is blocked.
  }
}

function readStoredRecovery(now = Date.now()): StoredRecoverySession | null {
  const target = storage();
  if (!target) return null;

  try {
    const raw = target.getItem(RECOVERY_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredRecoverySession>;
    const valid =
      parsed.version === 1 &&
      typeof parsed.accessToken === "string" &&
      typeof parsed.refreshToken === "string" &&
      typeof parsed.sourceRefreshToken === "string" &&
      typeof parsed.userId === "string" &&
      typeof parsed.createdAt === "number" &&
      typeof parsed.expiresAt === "number" &&
      typeof parsed.uses === "number" &&
      Number.isInteger(parsed.uses) &&
      parsed.uses >= 1 &&
      parsed.createdAt <= now + 60_000 &&
      parsed.expiresAt <= parsed.createdAt + RECOVERY_MAX_AGE_MS;

    if (!valid) {
      removeStoredRecovery();
      return null;
    }

    return parsed as StoredRecoverySession;
  } catch {
    removeStoredRecovery();
    return null;
  }
}

function writeStoredRecovery(value: StoredRecoverySession): boolean {
  try {
    const target = storage();
    if (!target) return false;
    target.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function sessionExpiresAt(session: Session, now: number, absoluteLimit: number) {
  const tokenExpiry = session.expires_at ? session.expires_at * 1000 : absoluteLimit;
  return Math.min(tokenExpiry, absoluteLimit, now + RECOVERY_MAX_AGE_MS);
}

export function registerRecoveryLinkUse(
  session: Session,
  sourceRefreshToken: string,
  now = Date.now(),
): RecoveryResumeResult {
  const existing = readStoredRecovery(now);

  if (existing?.sourceRefreshToken === sourceRefreshToken) {
    if (now >= existing.expiresAt) {
      removeStoredRecovery();
      return { status: "expired" };
    }
    if (existing.uses >= RECOVERY_MAX_USES) {
      return { status: "exhausted" };
    }

    const updated: StoredRecoverySession = {
      ...existing,
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      userId: session.user.id,
      uses: existing.uses + 1,
      expiresAt: sessionExpiresAt(
        session,
        now,
        existing.createdAt + RECOVERY_MAX_AGE_MS,
      ),
    };
    writeStoredRecovery(updated);
    return {
      status: "available",
      accessToken: updated.accessToken,
      refreshToken: updated.refreshToken,
      uses: updated.uses,
      usesRemaining: RECOVERY_MAX_USES - updated.uses,
    };
  }

  const expiresAt = sessionExpiresAt(session, now, now + RECOVERY_MAX_AGE_MS);
  if (expiresAt <= now) return { status: "expired" };

  const created: StoredRecoverySession = {
    version: 1,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    sourceRefreshToken,
    userId: session.user.id,
    createdAt: now,
    expiresAt,
    uses: 1,
  };
  writeStoredRecovery(created);
  return {
    status: "available",
    accessToken: created.accessToken,
    refreshToken: created.refreshToken,
    uses: 1,
    usesRemaining: RECOVERY_MAX_USES - 1,
  };
}

export function refreshStoredRecoverySession(session: Session, now = Date.now()) {
  const existing = readStoredRecovery(now);
  if (!existing || existing.userId !== session.user.id || now >= existing.expiresAt) {
    if (existing && now >= existing.expiresAt) removeStoredRecovery();
    return false;
  }

  return writeStoredRecovery({
    ...existing,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: sessionExpiresAt(
      session,
      now,
      existing.createdAt + RECOVERY_MAX_AGE_MS,
    ),
  });
}

export function consumeRecoveryResume(now = Date.now()): RecoveryResumeResult {
  const existing = readStoredRecovery(now);
  if (!existing) return { status: "missing" };
  if (now >= existing.expiresAt) {
    removeStoredRecovery();
    return { status: "expired" };
  }
  if (existing.uses >= RECOVERY_MAX_USES) return { status: "exhausted" };

  const updated = { ...existing, uses: existing.uses + 1 };
  writeStoredRecovery(updated);
  return {
    status: "available",
    accessToken: updated.accessToken,
    refreshToken: updated.refreshToken,
    uses: updated.uses,
    usesRemaining: RECOVERY_MAX_USES - updated.uses,
  };
}

export function hasStoredRecoverySession(now = Date.now()) {
  const existing = readStoredRecovery(now);
  if (!existing) return false;
  if (now >= existing.expiresAt) {
    removeStoredRecovery();
    return false;
  }
  return existing.uses <= RECOVERY_MAX_USES;
}

export function clearStoredRecoverySession() {
  removeStoredRecovery();
}
