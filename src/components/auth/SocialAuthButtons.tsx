import { Button } from "@/components/ui/button";
import {
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

export default function SocialAuthButtons({
  action,
  disabled = false,
  loadingProvider,
  onSelect,
}: SocialAuthButtonsProps) {
  const actionLabel = action === "signup" ? "Criar conta com" : "Entrar com";

  return (
    <div className="space-y-4">
      {SOCIAL_AUTH_PROVIDERS.map((provider) => {
        const loading = loadingProvider === provider;
        return (
          <Button
            key={provider}
            type="button"
            variant="outline"
            className="h-14 w-full justify-center gap-3 rounded-2xl border-border bg-white px-4 text-base font-semibold text-foreground shadow-sm hover:bg-accent/50"
            disabled={disabled || loadingProvider !== null}
            onClick={() => onSelect(provider)}
          >
            <GoogleMark />
            <span>{loading ? "Conectando..." : `${actionLabel} Google`}</span>
          </Button>
        );
      })}

      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-border/70" />
        <span className="text-[11px] font-medium uppercase text-muted-foreground">ou continue com e-mail</span>
        <span className="h-px flex-1 bg-border/70" />
      </div>
    </div>
  );
}
