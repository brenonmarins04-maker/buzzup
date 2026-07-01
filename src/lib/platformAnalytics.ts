import { supabase } from "@/integrations/supabase/client";

export type PlatformEventKey =
  | "landing_view"
  | "signup_cta_click"
  | "signup_success"
  | "workspace_entered"
  | "workspace_created"
  | "workspace_join_requested";

const SESSION_KEY = "buzzup.platform.session";

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getPlatformSessionId() {
  if (typeof window === "undefined") return "server";
  try {
    const current = window.localStorage.getItem(SESSION_KEY);
    if (current) return current;
    const next = randomId();
    window.localStorage.setItem(SESSION_KEY, next);
    return next;
  } catch {
    return "unknown";
  }
}

export async function trackPlatformEvent(
  eventKey: PlatformEventKey,
  options?: {
    email?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  try {
    await (supabase.rpc as any)("track_platform_event", {
      _event_key: eventKey,
      _session_id: getPlatformSessionId(),
      _email: options?.email?.trim().toLowerCase() || null,
      _metadata: options?.metadata ?? {},
    });
  } catch {
    // Tracking nunca deve quebrar o fluxo principal da aplicação.
  }
}
