import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from "@/integrations/supabase/client";

export const SOCIAL_AUTH_PROVIDERS = ["google", "apple"] as const;

// Mantém os provedores visíveis enquanto a configuração do OAuth é finalizada.
export const SOCIAL_AUTH_MAINTENANCE = true;

export type SocialAuthProvider = typeof SOCIAL_AUTH_PROVIDERS[number];

export const SOCIAL_AUTH_LABELS: Record<SocialAuthProvider, string> = {
  google: "Google",
  apple: "Apple",
};

export function getSocialAuthRedirectUrl(origin: string) {
  return new URL("/welcome", `${origin.replace(/\/$/, "")}/`).toString();
}

export class SocialAuthProviderDisabledError extends Error {
  constructor(provider: SocialAuthProvider) {
    super(`OAuth provider ${provider} is not enabled`);
    this.name = "SocialAuthProviderDisabledError";
  }
}

type SupabaseAuthSettings = {
  external?: Partial<Record<SocialAuthProvider, boolean>>;
};

export async function ensureSocialAuthProviderEnabled(provider: SocialAuthProvider) {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
    });
    if (!response.ok) return;

    const settings = await response.json() as SupabaseAuthSettings;
    if (settings.external?.[provider] === false) {
      throw new SocialAuthProviderDisabledError(provider);
    }
  } catch (error) {
    if (error instanceof SocialAuthProviderDisabledError) throw error;
    // A temporary settings request failure must not block a configured provider.
  }
}
