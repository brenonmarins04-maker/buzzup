import { Component, type ErrorInfo, type ReactNode } from "react";
import * as Sentry from "@sentry/react";

type Props = { children: ReactNode };
type State = { erro: Error | null };

/**
 * Contém o estrago de uma tela que quebrou.
 *
 * O app já tinha uma proteção, mas na raiz: qualquer erro em qualquer lugar
 * levava a tela inteira para "recarregue a página", inclusive o menu. Aqui o
 * erro para na área de conteúdo — o menu continua de pé e dá para ir a outra
 * tela sem recarregar nada.
 */
export default class RouteErrorBoundary extends Component<Props, State> {
  state: State = { erro: null };

  static getDerivedStateFromError(erro: Error): State {
    return { erro };
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    // Continua indo para o Sentry: conter o erro não é motivo para escondê-lo
    Sentry.captureException(erro, { extra: { componentStack: info.componentStack } });
  }

  render() {
    if (!this.state.erro) return this.props.children;

    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-base font-bold text-foreground">Esta tela não carregou.</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          O resto do BuzzUp continua funcionando — dá para ir a outra tela pelo menu.
        </p>
        <button
          type="button"
          onClick={() => this.setState({ erro: null })}
          className="mt-1 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
        >
          Tentar de novo
        </button>
      </div>
    );
  }
}
