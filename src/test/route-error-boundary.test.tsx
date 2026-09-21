import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

vi.mock("@sentry/react", () => ({ captureException: vi.fn() }));

/** Explode na primeira renderização; depois de `curar`, renderiza normal. */
let curar = false;
function TelaQuebrada() {
  if (!curar) throw new Error("boom");
  return <p>Conteúdo recuperado</p>;
}

describe("uma tela quebrada não derruba o app", () => {
  // O React registra o erro no console; silenciado para o teste ficar legível
  let erroSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    curar = false;
    erroSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => erroSpy.mockRestore());

  it("mostra o aviso da tela em vez de sumir com tudo", () => {
    render(
      <div>
        <nav>Menu do BuzzUp</nav>
        <RouteErrorBoundary><TelaQuebrada /></RouteErrorBoundary>
      </div>,
    );

    expect(screen.getByText("Esta tela não carregou.")).toBeInTheDocument();
    // O que está fora da tela continua de pé — era isso que se perdia antes
    expect(screen.getByText("Menu do BuzzUp")).toBeInTheDocument();
  });

  it("diz que o resto do app continua funcionando", () => {
    render(<RouteErrorBoundary><TelaQuebrada /></RouteErrorBoundary>);
    expect(screen.getByText(/dá para ir a outra tela pelo menu/i)).toBeInTheDocument();
  });

  it("o botão tenta renderizar de novo", () => {
    render(<RouteErrorBoundary><TelaQuebrada /></RouteErrorBoundary>);
    curar = true;
    fireEvent.click(screen.getByRole("button", { name: /Tentar de novo/ }));
    expect(screen.getByText("Conteúdo recuperado")).toBeInTheDocument();
  });

  it("manda o erro para o Sentry em vez de engolir", async () => {
    const Sentry = await import("@sentry/react");
    render(<RouteErrorBoundary><TelaQuebrada /></RouteErrorBoundary>);
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it("tela sã passa direto, sem interferência", () => {
    curar = true;
    render(<RouteErrorBoundary><TelaQuebrada /></RouteErrorBoundary>);
    expect(screen.getByText("Conteúdo recuperado")).toBeInTheDocument();
    expect(screen.queryByText("Esta tela não carregou.")).not.toBeInTheDocument();
  });
});
