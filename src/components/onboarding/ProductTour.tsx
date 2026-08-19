import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { AREAS } from "@/lib/areas";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import {
  buildTourSteps,
  hasSeenTour,
  isNewWorkspace,
  markTourSeen,
  type TourStep,
} from "@/lib/tour";

type Rect = { top: number; left: number; width: number; height: number };

const PADDING = 8;

/** Espera o elemento aparecer depois da navegação (a rota renderiza async). */
function waitForTarget(target: string, timeoutMs = 2500): Promise<HTMLElement | null> {
  return new Promise(resolve => {
    const started = Date.now();
    const tick = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
      if (el) return resolve(el);
      if (Date.now() - started > timeoutMs) return resolve(null);
      requestAnimationFrame(tick);
    };
    tick();
  });
}

export default function ProductTour() {
  const { user, isOwner, workspaceId, myWorkspaces } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  const [steps, setSteps] = useState<TourStep[]>([]);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [running, setRunning] = useState(false);
  // Anima o deslocamento só entre passos; durante o scroll acompanha na hora
  const [smooth, setSmooth] = useState(true);
  const startedRef = useRef(false);

  const step = steps[index];

  const start = useCallback(() => {
    const myArea = AREAS[0]?.path || "/projetos";
    setSteps(buildTourSteps({ areaPath: myArea, isOwner }));
    setIndex(0);
    setRunning(true);
  }, [isOwner]);

  // Mantém a versão mais recente de start() sem que a identidade dela
  // reexecute o efeito de início automático.
  const startRef = useRef(start);
  useEffect(() => { startRef.current = start; }, [start]);

  // Início automático para contas novas, e gatilho manual (Configurações)
  useEffect(() => {
    const onManualStart = () => startRef.current();
    window.addEventListener("buzzup:start-tour", onManualStart);
    return () => window.removeEventListener("buzzup:start-tour", onManualStart);
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    if (!user || !workspaceId) return;
    if (hasSeenTour(user.id, workspaceId)) return;
    // Dispara em workspace recém-criado — uma vez por workspace. Assim quem
    // cria um workspace novo vê a apresentação, mesmo com a conta antiga, e
    // workspaces já em uso não voltam a mostrá-la.
    const ws = myWorkspaces.find(w => w.workspace_id === workspaceId);
    if (!isNewWorkspace(ws?.created_at)) return;

    // startedRef só é marcado quando o tour realmente abre. Marcá-lo antes fazia
    // o tour sumir: o efeito reexecuta quando isOwner muda (o hub carrega logo
    // após entrar no primeiro workspace), o cleanup cancelava o timer e o guard
    // bloqueava a partir dali.
    const t = setTimeout(() => {
      if (startedRef.current) return;
      startedRef.current = true;
      startRef.current();
    }, 900);
    return () => clearTimeout(t);
    // Depende de valores estáveis (ids), não da identidade de user/start
  }, [user?.id, workspaceId, myWorkspaces]);

  // Navega para a rota do passo e posiciona o spotlight
  useEffect(() => {
    if (!running || !step) return;
    let cancelled = false;

    if (step.route && location.pathname !== step.route) {
      navigate(step.route);
      return; // reexecuta quando a rota mudar
    }

    if (!step.target) {
      setRect(null);
      return;
    }

    (async () => {
      const el = await waitForTarget(step.target!);
      if (cancelled) return;
      if (!el) { setRect(null); return; }
      setSmooth(true);
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // deixa o scroll assentar antes de medir
      setTimeout(() => {
        if (cancelled) return;
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      }, 380);
    })();

    return () => { cancelled = true; };
  }, [running, step, location.pathname, navigate]);

  // Reposiciona ao rolar/redimensionar
  useEffect(() => {
    if (!running || !step?.target) return;
    const update = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (!el) return;
      setSmooth(false);
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [running, step]);

  const finish = (how: "done" | "skipped") => {
    setRunning(false);
    setRect(null);
    if (user && workspaceId) markTourSeen(user.id, workspaceId, how);
  };

  if (!running || !step) return null;

  const isLast = index === steps.length - 1;
  const hole = rect
    ? {
        top: Math.max(rect.top - PADDING, 0),
        left: Math.max(rect.left - PADDING, 0),
        width: rect.width + PADDING * 2,
        height: rect.height + PADDING * 2,
      }
    : null;

  // O card fica SEMPRE no mesmo ponto da tela (rodapé central), em todos os
  // passos. Quem se move é o recorte de destaque — assim os botões Voltar,
  // Pular e Próximo nunca mudam de lugar entre um passo e outro.
  const cardStyle: React.CSSProperties = {
    position: "fixed",
    bottom: isMobile ? 88 : 28, // no celular, acima da navegação inferior
    left: "50%",
    transform: "translateX(-50%)",
    width: isMobile ? "calc(100vw - 24px)" : 440,
    maxWidth: "calc(100vw - 24px)",
  };

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Tour do BuzzUp">
      {/* Escurece a tela; o recorte marca o elemento em destaque */}
      {hole ? (
        <div
          className="pointer-events-none absolute rounded-2xl ring-2 ring-primary"
          style={{
            top: hole.top,
            left: hole.left,
            width: hole.width,
            height: hole.height,
            boxShadow: "0 0 0 9999px rgba(4, 32, 48, 0.72)",
            // Deslize longo com desaceleração suave (sem o "salto" do ease padrão)
            transition: smooth
              ? "top 620ms cubic-bezier(0.22, 1, 0.36, 1), left 620ms cubic-bezier(0.22, 1, 0.36, 1), width 620ms cubic-bezier(0.22, 1, 0.36, 1), height 620ms cubic-bezier(0.22, 1, 0.36, 1)"
              : "none",
            willChange: "top, left, width, height",
          }}
        />
      ) : (
        <div className="absolute inset-0" style={{ backgroundColor: "rgba(4, 32, 48, 0.72)" }} />
      )}

      <div
        style={cardStyle}
        className="glass-panel rounded-2xl bg-card p-4 shadow-2xl animate-fade-in"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-foreground">{step.title}</h2>
          </div>
          <button
            onClick={() => finish("skipped")}
            aria-label="Fechar tour"
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>

        <div className="mt-3 flex items-center gap-1.5">
          {steps.map((s, i) => (
            <span
              key={s.id}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-5 bg-primary" : "w-1.5 bg-border"
              }`}
            />
          ))}
        </div>

        {/* Posições fixas: os botões que não valem no passo ficam invisíveis,
            mas continuam ocupando o espaço para nada se mexer entre passos. */}
        <div className="mt-4 flex items-center gap-2">
          <Button
            variant="outline"
            className={`rounded-xl ${index === 0 ? "invisible" : ""}`}
            onClick={() => setIndex(i => i - 1)}
            disabled={index === 0}
          >
            Voltar
          </Button>
          <Button
            variant="ghost"
            className={`rounded-xl text-muted-foreground ${isLast ? "invisible" : ""}`}
            onClick={() => finish("skipped")}
            disabled={isLast}
          >
            Pular
          </Button>
          <Button
            className="ml-auto rounded-xl font-bold"
            onClick={() => (isLast ? finish("done") : setIndex(i => i + 1))}
          >
            {isLast ? "Começar a usar" : "Próximo"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
