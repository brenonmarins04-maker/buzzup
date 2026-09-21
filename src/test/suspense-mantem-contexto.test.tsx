import { render, screen } from "@testing-library/react";
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { describe, expect, it } from "vitest";

/**
 * A espera pelo arquivo de uma tela fica DENTRO do layout, não por fora.
 *
 * Por fora, a espera cobre o menu também: ao trocar de tela a pessoa vê a
 * página inteira sumir e voltar. Por dentro, só o conteúdo espera e o menu
 * continua no lugar — dá para clicar em outra coisa no meio do caminho.
 */

let montagens = 0;

function ProvedorDeDados({ children }: { children: ReactNode }) {
  useEffect(() => { montagens += 1; }, []);
  return <div>{children}</div>;
}

/** Simula o arquivo de uma tela que chega depois. */
function telaPreguicosa(texto: string) {
  return lazy(() =>
    new Promise<{ default: () => JSX.Element }>(resolve =>
      setTimeout(() => resolve({ default: () => <p>{texto}</p> }), 20),
    ),
  );
}

describe("a espera pela tela fica dentro do layout", () => {
  it("o menu continua visível enquanto a próxima tela chega", async () => {
    montagens = 0;
    const Um = telaPreguicosa("Tela um");
    const Dois = telaPreguicosa("Tela dois");

    function App() {
      const [rota, setRota] = useState<"um" | "dois">("um");
      return (
        <ProvedorDeDados>
          <nav>Menu do BuzzUp</nav>
          <button onClick={() => setRota("dois")}>ir</button>
          <Suspense fallback={<span>carregando</span>}>
            {rota === "um" ? <Um /> : <Dois />}
          </Suspense>
        </ProvedorDeDados>
      );
    }

    render(<App />);
    await screen.findByText("Tela um");

    screen.getByText("ir").click();
    await screen.findByText("Tela dois");

    expect(screen.getByText("Menu do BuzzUp")).toBeInTheDocument();
    expect(montagens).toBe(1);
  });

  it("o App de verdade tem a espera depois do provedor de dados", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/App.tsx", "utf8");

    const iProvider = src.indexOf("<DataProvider>");
    const iSuspense = src.indexOf("<Suspense", iProvider);
    const iOutlet = src.indexOf("<Outlet />", iProvider);

    expect(iProvider).toBeGreaterThan(-1);
    expect(iSuspense).toBeGreaterThan(iProvider);
    expect(iOutlet).toBeGreaterThan(iSuspense);
  });

  it("toda tela carregada sob demanda passa pelo tratamento de arquivo faltando", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/App.tsx", "utf8");

    // Nenhum lazy pode importar direto: sem o tratamento, um arquivo que
    // sumiu num deploy deixa a tela carregando para sempre
    const lazyCru = src.match(/lazy\(\(\) => import\(/g) ?? [];
    expect(lazyCru).toHaveLength(0);
    expect(src).toContain("carregarTela(() => import(");
  });
});
