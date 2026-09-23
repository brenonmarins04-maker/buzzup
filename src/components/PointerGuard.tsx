import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { destravarCliques } from "@/lib/cliquesTravados";

/**
 * Vigia o bloqueio de cliques deixado por um menu suspenso que desmontou
 * aberto — trocar de tela com um popover aberto travava a página inteira.
 *
 * Duas frentes: a cada troca de rota, e sempre que o estilo do <body> muda.
 * A checagem é adiada um instante porque, no fechamento normal, o bloqueio
 * some logo depois — e aí não há nada a fazer.
 */
export default function PointerGuard() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (typeof document === "undefined") return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const verificarDepois = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => destravarCliques(document), 250);
    };

    // Trocou de tela: o momento clássico de sobrar bloqueio
    verificarDepois();

    const observador = new MutationObserver(verificarDepois);
    // Os dois mecanismos: o estilo inline do menu e o atributo da trava de
    // rolagem. Observar só o estilo deixava metade dos casos passar.
    observador.observe(document.body, {
      attributes: true,
      attributeFilter: ["style", "data-scroll-locked"],
    });

    return () => {
      if (timer) clearTimeout(timer);
      observador.disconnect();
    };
  }, [pathname]);

  return null;
}
