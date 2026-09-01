import { useCallback, useMemo, useRef, useState } from "react";
import { CalendarCheck, Eraser } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  dragRange,
  minutesToLabel,
  slotAtOffset,
  SLOT_MIN,
  WEEKDAYS,
  WEEKDAYS_UTEIS,
} from "@/lib/agenda";
import {
  availabilityOf,
  mergeIntervals,
  subtractIntervals,
  type Interval,
} from "@/lib/availability";

const PX_PER_HOUR = 64;
const RANGE = { start: 6 * 60, end: 23 * 60 };

type Drag = { weekday: number; anchor: number; current: number; apagando: boolean; moved: boolean };

function DayColumn({
  weekday, blocos, drag, onDragStart, onDragMove, onDragEnd, onSlotClick,
}: {
  weekday: number;
  blocos: Interval[];
  drag: Drag | null;
  onDragStart: (weekday: number, slot: number, apagando: boolean) => void;
  onDragMove: (weekday: number, slot: number) => void;
  onDragEnd: (weekday: number) => void;
  onSlotClick: (weekday: number, slot: number, marcado: boolean) => void;
}) {
  const slots: number[] = [];
  for (let m = RANGE.start; m < RANGE.end; m += SLOT_MIN) slots.push(m);

  const slotFromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return slotAtOffset(e.clientY - rect.top, RANGE, PX_PER_HOUR);
  };

  /** Já está livre neste horário? Então o arraste apaga em vez de marcar. */
  const jaMarcado = (slot: number) =>
    blocos.some(b => slot >= b.startMin && slot < b.endMin);

  const handleDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch" || e.button > 0) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* segue sem captura */ }
    const slot = slotFromEvent(e);
    onDragStart(weekday, slot, jaMarcado(slot));
  };

  const preview = drag && drag.weekday === weekday ? dragRange(drag.anchor, drag.current) : null;

  return (
    <div
      className="relative select-none border-l border-border"
      style={{ height: (RANGE.end - RANGE.start) / 60 * PX_PER_HOUR, touchAction: "pan-y" }}
      onPointerDown={handleDown}
      onPointerMove={e => { if (drag?.weekday === weekday) onDragMove(weekday, slotFromEvent(e)); }}
      onPointerUp={() => { if (drag?.weekday === weekday) onDragEnd(weekday); }}
      onPointerCancel={() => { if (drag?.weekday === weekday) onDragEnd(weekday); }}
    >
      {/* Meias horas clicáveis — também servem ao teclado */}
      {slots.map(m => {
        const marcado = jaMarcado(m);
        return (
          <button
            key={m}
            type="button"
            aria-pressed={marcado}
            aria-label={`${marcado ? "Remover" : "Marcar"} disponibilidade às ${minutesToLabel(m)}`}
            onClick={() => onSlotClick(weekday, m, marcado)}
            className="absolute inset-x-0 border-b border-border/40 hover:bg-primary/5"
            style={{
              top: ((m - RANGE.start) / 60) * PX_PER_HOUR,
              height: (SLOT_MIN / 60) * PX_PER_HOUR,
            }}
          />
        );
      })}

      {/* Blocos livres */}
      {blocos.map(b => (
        <div
          key={`${b.startMin}-${b.endMin}`}
          className="pointer-events-none absolute inset-x-1 rounded-lg bg-emerald-500/25 ring-1 ring-emerald-500/60"
          style={{
            top: ((b.startMin - RANGE.start) / 60) * PX_PER_HOUR,
            height: ((b.endMin - b.startMin) / 60) * PX_PER_HOUR - 2,
          }}
        >
          <span className="block px-1.5 py-0.5 text-[11px] font-bold text-foreground">
            {minutesToLabel(b.startMin)}–{minutesToLabel(b.endMin)}
          </span>
        </div>
      ))}

      {preview && (
        <div
          className={`pointer-events-none absolute inset-x-1 rounded-lg border-2 ${
            drag?.apagando ? "border-red-500 bg-red-500/20" : "border-emerald-500 bg-emerald-500/30"
          }`}
          style={{
            top: ((preview.startMin - RANGE.start) / 60) * PX_PER_HOUR,
            height: ((preview.endMin - preview.startMin) / 60) * PX_PER_HOUR,
          }}
        />
      )}
    </div>
  );
}

export default function AvailabilityTab() {
  const { availability, setMyAvailabilityForDay } = useData();
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const [showWeekend, setShowWeekend] = useState(false);
  const [mobileDay, setMobileDay] = useState(() => {
    const hoje = new Date().getDay();
    return hoje === 0 || hoje === 6 ? 1 : hoje;
  });
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragEndedAt = useRef(0);

  const meus = useMemo(
    () => (user ? availability.filter(a => a.userId === user.id) : []),
    [availability, user],
  );

  const blocosDe = useCallback(
    (weekday: number) => (user ? availabilityOf(meus, user.id, weekday) : []),
    [meus, user],
  );

  /** Soma ou tira uma faixa da minha disponibilidade daquele dia. */
  const aplicar = useCallback((weekday: number, faixa: Interval, apagando: boolean) => {
    if (!user) return;
    const atuais = availabilityOf(meus, user.id, weekday);
    const novos = apagando
      ? subtractIntervals(atuais, [faixa])
      : mergeIntervals([...atuais, faixa]);
    void setMyAvailabilityForDay(weekday, novos);
  }, [user, meus, setMyAvailabilityForDay]);

  const onDragStart = useCallback((weekday: number, slot: number, apagando: boolean) => {
    setDrag({ weekday, anchor: slot, current: slot, apagando, moved: false });
  }, []);

  const onDragMove = useCallback((weekday: number, slot: number) => {
    setDrag(d => (d && d.weekday === weekday && d.current !== slot
      ? { ...d, current: slot, moved: true }
      : d));
  }, []);

  const onDragEnd = useCallback((weekday: number) => {
    // Sem movimento é um clique: quem trata é o onSlotClick, senão a meia hora
    // seria aplicada duas vezes (uma por gesto, outra pelo clique do botão)
    if (drag && drag.weekday === weekday && drag.moved) {
      dragEndedAt.current = Date.now();
      aplicar(weekday, dragRange(drag.anchor, drag.current), drag.apagando);
    }
    setDrag(null);
  }, [drag, aplicar]);

  const onSlotClick = useCallback((weekday: number, slot: number, marcado: boolean) => {
    // O clique que fecha um arraste não pode aplicar a faixa de novo
    if (Date.now() - dragEndedAt.current < 300) return;
    aplicar(weekday, { startMin: slot, endMin: slot + SLOT_MIN }, marcado);
  }, [aplicar]);

  const limparDia = (weekday: number) => { void setMyAvailabilityForDay(weekday, []); };

  const dias = isMobile
    ? WEEKDAYS.filter(d => d.key === mobileDay)
    : (showWeekend ? WEEKDAYS : WEEKDAYS_UTEIS);

  const gridCols = `56px repeat(${dias.length}, minmax(0, 1fr))`;
  const horas: number[] = [];
  for (let m = RANGE.start; m <= RANGE.end; m += 60) horas.push(m);

  const totalBlocos = meus.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
            <CalendarCheck className="h-5 w-5 text-emerald-500" />
            Meus horários livres
          </h2>
          <p className="text-sm text-muted-foreground">
            {isMobile
              ? "Toque nas meias horas em que você costuma estar livre."
              : "Arraste para marcar quando você costuma estar livre. Arraste sobre um bloco verde para apagar."}
          </p>
        </div>
        {!isMobile && (
          <button
            type="button"
            onClick={() => setShowWeekend(v => !v)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              showWeekend ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            Fim de semana
          </button>
        )}
      </div>

      {isMobile && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {WEEKDAYS.map(d => (
            <button
              key={d.key}
              type="button"
              onClick={() => setMobileDay(d.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                mobileDay === d.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {d.short}
            </button>
          ))}
        </div>
      )}

      <div className="glass-panel overflow-hidden rounded-2xl">
        <div className="grid border-b border-border bg-card/60" style={{ gridTemplateColumns: gridCols }}>
          <div />
          {dias.map(d => (
            <div key={d.key} className="border-l border-border px-2 py-2 text-center">
              <span className="text-sm font-bold text-foreground">{isMobile ? d.label : d.short}</span>
              <button
                type="button"
                onClick={() => limparDia(d.key)}
                className="mt-0.5 flex w-full items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-red-400"
              >
                <Eraser className="h-3 w-3" />
                Limpar
              </button>
            </div>
          ))}
        </div>

        <div className="grid overflow-x-auto" style={{ gridTemplateColumns: gridCols }}>
          <div className="relative" style={{ height: (RANGE.end - RANGE.start) / 60 * PX_PER_HOUR }}>
            {horas.map(m => (
              <span
                key={m}
                className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-muted-foreground"
                style={{ top: ((m - RANGE.start) / 60) * PX_PER_HOUR }}
              >
                {minutesToLabel(m)}
              </span>
            ))}
          </div>

          {dias.map(d => (
            <DayColumn
              key={d.key}
              weekday={d.key}
              blocos={blocosDe(d.key)}
              drag={drag}
              onDragStart={onDragStart}
              onDragMove={onDragMove}
              onDragEnd={onDragEnd}
              onSlotClick={onSlotClick}
            />
          ))}
        </div>
      </div>

      {totalBlocos === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center">
          <p className="text-sm font-medium text-foreground">
            Você ainda não marcou nenhum horário livre.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Sem isso, na busca por horário em comum você conta como livre o tempo todo.
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Só você edita a sua disponibilidade. As outras pessoas do workspace
        conseguem vê-la para achar um horário em comum.
      </p>
    </div>
  );
}
