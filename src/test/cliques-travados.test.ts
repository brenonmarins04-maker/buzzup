import { beforeEach, describe, expect, it } from "vitest";
import { cliquesTravados, destravarCliques, temMenuAberto } from "@/lib/cliquesTravados";

/**
 * Regressão: diálogos e popovers põem `pointer-events: none` no <body> e
 * tiram ao fechar. Desmontando abertos — trocar de tela com um popover
 * aberto — a limpeza nunca roda e a página toda para de responder a cliques.
 */

function abrirMenu(tipo: "dialog" | "popover" = "dialog") {
  const el = document.createElement("div");
  if (tipo === "dialog") {
    el.setAttribute("role", "dialog");
    el.setAttribute("data-state", "open");
  } else {
    el.setAttribute("data-radix-popper-content-wrapper", "");
  }
  document.body.appendChild(el);
  return el;
}

const bloquear = () => { document.body.style.pointerEvents = "none"; };

describe("destravar cliques", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.body.removeAttribute("style");
  });

  it("página normal: nada a fazer", () => {
    expect(cliquesTravados(document)).toBe(false);
    expect(destravarCliques(document)).toBe(false);
  });

  it("menu aberto de verdade continua bloqueando — é o certo", () => {
    abrirMenu("dialog");
    bloquear();
    expect(temMenuAberto(document)).toBe(true);
    expect(destravarCliques(document)).toBe(false);
    expect(document.body.style.pointerEvents).toBe("none");
  });

  it("popover aberto também segura o bloqueio", () => {
    abrirMenu("popover");
    bloquear();
    expect(destravarCliques(document)).toBe(false);
  });

  it("o caso do problema: menu sumiu e deixou o bloqueio", () => {
    const menu = abrirMenu("dialog");
    bloquear();
    // Trocar de tela desmonta o menu sem ele se fechar
    menu.remove();

    expect(cliquesTravados(document)).toBe(true);
    expect(destravarCliques(document)).toBe(true);
    expect(document.body.style.pointerEvents).toBe("");
  });

  it("o mesmo com popover, que é o do emoji e do apelido", () => {
    const menu = abrirMenu("popover");
    bloquear();
    menu.remove();
    expect(destravarCliques(document)).toBe(true);
    expect(document.body.style.pointerEvents).toBe("");
  });

  it("menu fechando normalmente não conta como aberto", () => {
    const el = document.createElement("div");
    el.setAttribute("role", "dialog");
    el.setAttribute("data-state", "closed");
    document.body.appendChild(el);
    bloquear();

    expect(temMenuAberto(document)).toBe(false);
    expect(destravarCliques(document)).toBe(true);
  });

  it("não mexe em outros estilos do body", () => {
    const menu = abrirMenu("dialog");
    document.body.style.pointerEvents = "none";
    document.body.style.overflow = "hidden";
    menu.remove();

    destravarCliques(document);
    expect(document.body.style.pointerEvents).toBe("");
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("destravar duas vezes é inofensivo", () => {
    const menu = abrirMenu("dialog");
    bloquear();
    menu.remove();
    expect(destravarCliques(document)).toBe(true);
    expect(destravarCliques(document)).toBe(false);
  });
});
