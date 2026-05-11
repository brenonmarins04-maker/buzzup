import { useCallback, useRef } from "react";

export type DragDropResult =
  | { kind: "day"; date: string }
  | { kind: "parking" }
  | { kind: "none" };

type StartArgs<T> = {
  event: React.PointerEvent;
  payload: T;
  label: string;
  color: string;
};

type Options<T> = {
  delay?: number; // ms
  moveTolerance?: number; // px before activation cancels
  onDrop: (payload: T, target: DragDropResult) => void;
  enabled?: boolean;
};

/**
 * Long-press drag for touch/pointer.
 * Activates after `delay` ms of holding without significant movement,
 * then a ghost follows the finger until release. On release, hit-tests
 * the element under the pointer for `data-drop-day` or `data-drop-parking`.
 */
export function useLongPressDrag<T>({ delay = 200, moveTolerance = 8, onDrop, enabled = true }: Options<T>) {
  const timerRef = useRef<number | null>(null);
  const activeRef = useRef(false);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const payloadRef = useRef<T | null>(null);
  const lastTargetRef = useRef<HTMLElement | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null; }
    if (ghostRef.current) { ghostRef.current.remove(); ghostRef.current = null; }
    if (lastTargetRef.current) {
      lastTargetRef.current.classList.remove("lpd-drop-active");
      lastTargetRef.current = null;
    }
    activeRef.current = false;
    startPosRef.current = null;
    payloadRef.current = null;
  }, []);

  const activate = useCallback((label: string, color: string, x: number, y: number) => {
    activeRef.current = true;
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try { (navigator as any).vibrate?.(10); } catch {}
    }
    const ghost = document.createElement("div");
    ghost.textContent = label;
    ghost.style.cssText = `
      position: fixed; top: 0; left: 0;
      transform: translate(${x - 60}px, ${y - 16}px);
      background: ${color}; color: white;
      padding: 6px 10px; border-radius: 6px;
      font-size: 12px; font-weight: 600;
      max-width: 160px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      pointer-events: none; z-index: 9999;
      box-shadow: 0 8px 24px rgba(0,0,0,0.25);
      opacity: 0.95;
    `;
    document.body.appendChild(ghost);
    ghostRef.current = ghost;
  }, []);

  const updateTargetHighlight = (el: HTMLElement | null) => {
    if (lastTargetRef.current === el) return;
    if (lastTargetRef.current) lastTargetRef.current.classList.remove("lpd-drop-active");
    if (el) el.classList.add("lpd-drop-active");
    lastTargetRef.current = el;
  };

  const findTarget = (x: number, y: number): { el: HTMLElement | null; result: DragDropResult } => {
    if (ghostRef.current) ghostRef.current.style.visibility = "hidden";
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    if (ghostRef.current) ghostRef.current.style.visibility = "visible";
    if (!el) return { el: null, result: { kind: "none" } };
    const dayEl = el.closest("[data-drop-day]") as HTMLElement | null;
    if (dayEl) return { el: dayEl, result: { kind: "day", date: dayEl.dataset.dropDay! } };
    const parkEl = el.closest("[data-drop-parking]") as HTMLElement | null;
    if (parkEl) return { el: parkEl, result: { kind: "parking" } };
    return { el: null, result: { kind: "none" } };
  };

  const start = useCallback(({ event, payload, label, color }: StartArgs<T>) => {
    if (!enabled) return;
    if (event.pointerType === "mouse") return; // mouse uses native HTML5 dnd
    startPosRef.current = { x: event.clientX, y: event.clientY };
    payloadRef.current = payload;
    const x0 = event.clientX, y0 = event.clientY;
    timerRef.current = window.setTimeout(() => {
      activate(label, color, x0, y0);
    }, delay);
  }, [activate, delay, enabled]);

  const move = useCallback((event: React.PointerEvent) => {
    if (!startPosRef.current) return;
    const dx = event.clientX - startPosRef.current.x;
    const dy = event.clientY - startPosRef.current.y;
    if (!activeRef.current) {
      if (Math.hypot(dx, dy) > moveTolerance) {
        // user is scrolling — cancel pending press
        if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null; }
        startPosRef.current = null;
        payloadRef.current = null;
      }
      return;
    }
    // active drag: prevent page scroll while moving
    event.preventDefault();
    if (ghostRef.current) {
      ghostRef.current.style.transform = `translate(${event.clientX - 60}px, ${event.clientY - 16}px)`;
    }
    const { el } = findTarget(event.clientX, event.clientY);
    updateTargetHighlight(el);
  }, [moveTolerance]);

  const end = useCallback((event: React.PointerEvent) => {
    if (!activeRef.current) { cleanup(); return; }
    const { result } = findTarget(event.clientX, event.clientY);
    const payload = payloadRef.current;
    cleanup();
    if (payload != null) onDrop(payload, result);
  }, [cleanup, onDrop]);

  const cancel = useCallback(() => { cleanup(); }, [cleanup]);

  return {
    handlers: {
      onPointerDown: (event: React.PointerEvent, args: Omit<StartArgs<T>, "event">) =>
        start({ event, ...args }),
      onPointerMove: move,
      onPointerUp: end,
      onPointerCancel: cancel,
    },
    isActive: () => activeRef.current,
  };
}