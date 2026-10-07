import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PointerGuard from "@/components/PointerGuard";

/**
 * O vigia precisa recuperar a página MESMO sem nenhum evento novo.
 *
 * Reagir só a mutações deixava um buraco: se a conferência caísse num
 * instante em que o menu ainda parecia aberto, ninguém mais olharia e o
 * bloqueio ficava até recarregar — que é o relato ("a página nem rola,
 * recarregar resolve").
 */

const montar = () => render(<MemoryRouter><PointerGuard /></MemoryRouter>);

function travar() {
  document.body.style.pointerEvents = "none";
  document.body.setAttribute("data-scroll-locked", "");
}

const travado = () =>
  document.body.style.pointerEvents === "none"
  || document.body.hasAttribute("data-scroll-locked");

describe("vigia do bloqueio", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
    document.body.removeAttribute("style");
    document.body.removeAttribute("data-scroll-locked");
  });
  afterEach(() => vi.useRealTimers());

  it("destrava sozinho, sem precisar de evento nenhum", () => {
    montar();
    travar();
    expect(travado()).toBe(true);

    // Nenhuma troca de tela, nenhuma mutação depois: só o tempo passando
    act(() => { vi.advanceTimersByTime(2000); });

    expect(travado()).toBe(false);
  });

  it("não espera mais que poucos segundos", () => {
    montar();
    travar();
    act(() => { vi.advanceTimersByTime(1600); });
    expect(travado()).toBe(false);
  });

  it("com menu de fato aberto, não destrava", () => {
    montar();
    const menu = document.createElement("div");
    menu.setAttribute("role", "dialog");
    menu.setAttribute("data-state", "open");
    document.body.appendChild(menu);
    travar();

    act(() => { vi.advanceTimersByTime(5000); });

    expect(travado()).toBe(true);
  });

  it("destrava assim que o menu aberto some", () => {
    montar();
    const menu = document.createElement("div");
    menu.setAttribute("role", "dialog");
    menu.setAttribute("data-state", "open");
    document.body.appendChild(menu);
    travar();
    act(() => { vi.advanceTimersByTime(2000); });
    expect(travado()).toBe(true);

    // Trocar de tela desmonta o menu sem ele se fechar
    menu.remove();
    act(() => { vi.advanceTimersByTime(2000); });
    expect(travado()).toBe(false);
  });

  it("página sã continua intocada", () => {
    montar();
    document.body.style.overflow = "auto";
    act(() => { vi.advanceTimersByTime(5000); });
    expect(document.body.style.overflow).toBe("auto");
    expect(travado()).toBe(false);
  });

  it("ao desmontar, para de rondar", () => {
    const view = montar();
    view.unmount();
    travar();
    act(() => { vi.advanceTimersByTime(5000); });
    // Sem o vigia montado, nada acontece — prova que a ronda foi encerrada
    expect(travado()).toBe(true);
  });
});
