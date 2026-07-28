import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "@/pages/LoginPage";
import { getSocialAuthRedirectUrl } from "@/lib/socialAuth";

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

  it("mostra somente o Google no login e inicia o OAuth", () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <LoginPage />
      </MemoryRouter>,
    );

    const googleButton = screen.getByRole("button", { name: "Entrar com Google" });
    expect(googleButton).toBeEnabled();
    expect(screen.queryByText(/Apple/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Manutenção/i)).not.toBeInTheDocument();

    fireEvent.click(googleButton);
    expect(mocks.signInWithProvider).toHaveBeenCalledWith("google");
  });

  it("mostra somente o Google no cadastro e inicia o OAuth", () => {
    render(
      <MemoryRouter initialEntries={["/login?mode=signup"]}>
        <LoginPage />
      </MemoryRouter>,
    );

    const googleButton = screen.getByRole("button", { name: "Criar conta com Google" });
    expect(googleButton).toBeEnabled();
    expect(screen.queryByText(/Apple/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Manutenção/i)).not.toBeInTheDocument();

    fireEvent.click(googleButton);
    expect(mocks.signInWithProvider).toHaveBeenCalledWith("google");
  });
});
