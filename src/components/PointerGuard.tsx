import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { destravarCliques } from "@/lib/cliquesTravados";

/** De quanto em quanto tempo conferir, independente de qualquer evento. */
const INTERVALO_MS = 1500;

/**
 * Vigia o bloqueio deixado por um menu suspenso que desmontou aberto.
 *
 * Um diálogo aberto bloqueia clique e rolagem do <body> e desfaz isso ao
 * fechar. Desmontando antes de fechar — trocar de tela com ele na tela — a
 * limpeza nunca roda: a página para de rolar e de aceitar cliques, e só
 * recarregando volta.
 *
 * Três frentes. As duas primeiras reagem na hora; a terceira é a garantia:
 * reagir a eventos não basta, porque a checagem pode cair num instante em que
 * o menu ainda parece aberto — e aí, sem nenhum evento novo, ninguém mais
 * olharia. Com a conferência periódica, o pior caso é ficar travado por um
 * segundo e meio em vez de até recarregar.
 *
 * O custo é uma busca de três seletores a cada ciclo, o que não aparece em
 * medição nenhuma.
 */
export default function PointerGuard() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (typeof document === "undefined") return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const conferirLogo = () => {
      if (timer) clearTimeout(timer);
      // Um instante de espera: no fechamento normal o bloqueio some sozinho
      // logo depois, e aí não há nada a corrigir
      timer = setTimeout(() => destravarCliques(document), 250);
    };

    // 1) Trocou de tela: o momento clássico de sobrar bloqueio
    conferirLogo();

    // 2) O <body> mudou. São dois mecanismos: o estilo inline do clique e o
    //    atributo da rolagem. Os portais também entram e saem como filhos.
    const observador = new MutationObserver(conferirLogo);
    observador.observe(document.body, {
      attributes: true,
      attributeFilter: ["style", "data-scroll-locked"],
      childList: true,
    });

    // 3) A garantia, para o caso de nenhum evento chegar na hora certa
    const ronda = setInterval(() => destravarCliques(document), INTERVALO_MS);

    return () => {
      if (timer) clearTimeout(timer);
      observador.disconnect();
      clearInterval(ronda);
    };
  }, [pathname]);

  return null;
}
