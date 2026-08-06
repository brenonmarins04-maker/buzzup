// Tour guiado para contas novas — funciona no celular e no computador.
// Cada passo pode navegar para uma rota e destacar um elemento marcado com
// data-tour="<target>".

export type TourStep = {
  id: string;
  /** Rota visitada antes de mostrar o passo (opcional) */
  route?: string;
  /** data-tour do elemento destacado. Sem alvo = card central. */
  target?: string;
  title: string;
  body: string;
  /** Passo só aparece para o owner (ex.: código de convite) */
  ownerOnly?: boolean;
};

export const TOUR_VERSION = "v1";

export function tourStorageKey(userId: string) {
  return `buzzup.tour.${TOUR_VERSION}.${userId}`;
}

export function hasSeenTour(userId: string): boolean {
  try {
    return !!localStorage.getItem(tourStorageKey(userId));
  } catch {
    return true; // storage bloqueado: não insiste com o tour
  }
}

export function markTourSeen(userId: string, how: "done" | "skipped") {
  try {
    localStorage.setItem(tourStorageKey(userId), how);
  } catch {
    // modo privado pode bloquear — o tour só não será lembrado
  }
}

export function clearTourSeen(userId: string) {
  try {
    localStorage.removeItem(tourStorageKey(userId));
  } catch {
    // ignore
  }
}

/** Conta criada há pouco tempo — evita disparar o tour para quem já usa o app. */
export function isNewAccount(createdAt?: string | null, days = 7): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  return Date.now() - created < days * 24 * 60 * 60 * 1000;
}

export function buildTourSteps(opts: { areaPath: string; isOwner: boolean }): TourStep[] {
  const steps: TourStep[] = [
    {
      id: "welcome",
      route: "/",
      title: "Bem-vindo ao BuzzUp! 🎉",
      body: "Vamos dar uma volta rápida pelo app para você saber onde fica cada coisa. Leva menos de um minuto.",
    },
    {
      id: "my-demands",
      route: "/",
      target: "my-demands",
      title: "Suas demandas",
      body: "Aqui ficam as demandas atribuídas a você, com prazo e status. É só tocar em concluir quando terminar.",
    },
    {
      id: "my-points",
      route: "/",
      target: "my-points",
      title: "Seus pontos",
      body: "Cada demanda concluída vira ponto. Aqui você acompanha quantos pontos tem e sua posição no ranking.",
    },
    {
      id: "ranking",
      route: "/",
      target: "ranking",
      title: "Ranking geral",
      body: "O ranking de todo mundo do workspace. Uma competição saudável para manter as demandas em dia!",
    },
    {
      id: "shortcuts",
      route: "/",
      target: "shortcuts",
      title: "Atalhos gerais",
      body: "Links importantes da sua entidade — planilhas, drive, formulários — todos reunidos em um lugar só.",
    },
    {
      id: "calendar",
      route: "/calendar",
      title: "Calendário",
      body: "Aqui você vê a calendarização e as demandas da entidade inteira: o que todas as áreas estão fazendo, no dia a dia.",
    },
    {
      id: "areas",
      route: areaPathOrDefault(opts.areaPath),
      target: "area-demands",
      title: "Áreas",
      body: "Escolha uma área e veja o quadro dela: as demandas de cada pessoa, lado a lado. Dá para segurar uma demanda e arrastar para outra pessoa.",
    },
    {
      id: "config",
      route: "/configuracoes",
      title: "Configurações",
      body: "Aqui você personaliza tudo: pessoas e cargos, áreas e times, gamificação, atalhos e relatórios.",
    },
  ];

  if (opts.isOwner) {
    steps.push({
      id: "invite",
      route: "/members",
      target: "invite-code",
      title: "Chame a sua equipe",
      body: "Toque no código para copiar e mande para o pessoal da sua entidade. Com ele, todo mundo entra no seu workspace.",
      ownerOnly: true,
    });
  }

  steps.push({
    id: "done",
    title: "Tudo pronto! 🚀",
    body: opts.isOwner
      ? "Agora é só compartilhar o código e começar a organizar as demandas. Você pode rever este tour em Configurações."
      : "Agora é só começar a organizar as suas demandas. Você pode rever este tour em Configurações.",
  });

  return steps;
}

function areaPathOrDefault(path: string) {
  return path && path.startsWith("/") ? path : "/projetos";
}
