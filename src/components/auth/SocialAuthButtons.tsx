import { Button } from "@/components/ui/button";
import {
  SOCIAL_AUTH_LABELS,
  SOCIAL_AUTH_PROVIDERS,
  type SocialAuthProvider,
} from "@/lib/socialAuth";

type SocialAuthButtonsProps = {
  action: "login" | "signup";
  disabled?: boolean;
  loadingProvider: SocialAuthProvider | null;
  onSelect: (provider: SocialAuthProvider) => void;
};

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.37l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.6 0-4.81-1.76-5.6-4.13H3.06v2.62A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.4 13.92A6 6 0 0 1 6.08 12c0-.67.12-1.32.32-1.92V7.46H3.06A10 10 0 0 0 2 12c0 1.62.39 3.15 1.06 4.54l3.34-2.62Z" />
      <path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.94 5.46l3.34 2.62c.79-2.37 3-4.13 5.6-4.13Z" />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0 fill-current">
      <path d="M16.7 12.77c-.02-2.28 1.86-3.39 1.95-3.44a4.18 4.18 0 0 0-3.29-1.78c-1.38-.15-2.72.83-3.42.83-.72 0-1.81-.82-2.98-.8a4.36 4.36 0 0 0-3.67 2.24c-1.59 2.75-.4 6.8 1.12 9.02.76 1.09 1.64 2.3 2.81 2.25 1.15-.05 1.58-.72 2.97-.72 1.37 0 1.77.72 2.97.69 1.23-.02 2.01-1.09 2.74-2.19a8.9 8.9 0 0 0 1.26-2.57 3.93 3.93 0 0 1-2.46-3.53Zm-2.24-6.69A4.02 4.02 0 0 0 15.38 3a4.1 4.1 0 0 0-2.84 1.47 3.84 3.84 0 0 0-.95 3 3.39 3.39 0 0 0 2.87-1.39Z" />
    </svg>
  );
}

export default function SocialAuthButtons({
  action,
  disabled = false,
  loadingProvider,
  onSelect,
}: SocialAuthButtonsProps) {
  const actionLabel = action === "signup" ? "Criar conta com" : "Entrar com";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {SOCIAL_AUTH_PROVIDERS.map((provider) => {
          const loading = loadingProvider === provider;
          return (
            <Button
              key={provider}
              type="button"
              variant="outline"
              className="h-12 rounded-2xl border-border/80 bg-white text-sm font-semibold text-foreground shadow-sm hover:-translate-y-0.5 hover:border-primary/35 hover:bg-white hover:shadow-md transition-all"
              disabled={disabled || loadingProvider !== null}
              onClick={() => onSelect(provider)}
            >
              {provider === "google" ? <GoogleMark /> : <AppleMark />}
              <span>{loading ? "Conectando..." : `${actionLabel} ${SOCIAL_AUTH_LABELS[provider]}`}</span>
            </Button>
          );
        })}
      </div>

      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-border/70" />
        <span className="text-[11px] font-medium uppercase text-muted-foreground">ou continue com e-mail</span>
        <span className="h-px flex-1 bg-border/70" />
      </div>
    </div>
  );
}
