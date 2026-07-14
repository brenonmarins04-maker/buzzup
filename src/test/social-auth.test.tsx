import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "@/pages/LoginPage";
import {
  getSocialAuthRedirectUrl,
  SocialAuthProviderDisabledError,
} from "@/lib/socialAuth";

const mocks = vi.hoisted(() => ({
  signInWithProvider: vi.fn(async () => ({ error: null as Error | null })),
  signIn: vi.fn(),
  signUp: vi.fn(),
  resetPassword: vi.fn(),
  resendConfirmation: vi.fn(),
  trackPlatformEvent: vi.fn(async () => undefined),
  toastError: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    signIn: mocks.signIn,
    signInWithProvider: mocks.signInWithProvider,
    signUp: mocks.signUp,
    resetPassword: mocks.resetPassword,
    resendConfirmation: mocks.resendConfirmation,
  }),
}));

vi.mock("@/lib/platformAnalytics", () => ({
  trackPlatformEvent: mocks.trackPlatformEvent,
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: vi.fn(),
    info: vi.fn(),
  },
}));

describe("social authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.signInWithProvider.mockResolvedValue({ error: null });
  });

  it("returns to the workspace hub after the provider callback", () => {
    expect(getSocialAuthRedirectUrl("https://usebuzzup.com.br"))
      .toBe("https://usebuzzup.com.br/welcome");
  });

  it("starts Google login from the login screen", async () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Entrar com Google" }));

    await waitFor(() => {
      expect(mocks.signInWithProvider).toHaveBeenCalledWith("google");
    });
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it("offers Google and Apple directly on the create-account screen", () => {
    render(
      <MemoryRouter initialEntries={["/login?mode=signup"]}>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Criar conta com Google" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar conta com Apple" })).toBeInTheDocument();
    expect(screen.queryByText("Confirme seu e-mail")).not.toBeInTheDocument();
  });

  it("explains when a provider still needs Supabase configuration", async () => {
    mocks.signInWithProvider.mockResolvedValue({
      error: new SocialAuthProviderDisabledError("apple"),
    });

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Entrar com Apple" }));

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Entrar com Apple ainda precisa ser ativado no Supabase.",
      );
    });
  });
});
