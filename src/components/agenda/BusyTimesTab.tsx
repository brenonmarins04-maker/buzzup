import { useCallback, useMemo, useRef, useState } from "react";
import { CalendarX, Eraser, Hand, MoveVertical } from "lucide-react";
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
  mergeIntervals,
  subtractIntervals,
  unavailableOf,
  type Interval,
} from "@/lib/unavailability";

const PX_PER_HOUR = 64;
const RANGE = { start: 6 * 60, end: 23 * 60 };

type Drag = { weekday: number; anchor: number; current: number; apagando: boolean; moved: boolean };

function DayColumn({
  weekday, blocos, drag, onDragStart, onDragMove, onDragEnd, onSlotClick, pintar,
}: {
  weekday: number;
  blocos: Interval[];
  drag: Drag | null;
  onDragStart: (weekday: number, slot: number, apagando: boolean) => void;
  onDragMove: (weekday: number, slot: number) => void;
  onDragEnd: (weekday: number) => void;
  onSlotClick: (weekday: number, slot: number, marcado: boolean) => void;
  /** No toque, só arrasta com o modo de pintura ligado */
  pintar: boolean;
}) {
  const slots: number[] = [];
  for (let m = RANGE.start; m < RANGE.end; m += SLOT_MIN) slots.push(m);

  const slotFromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return slotAtOffset(e.clientY - rect.top, RANGE, PX_PER_HOUR);
  };

  /** Já está ocupado neste horário? Então o arraste apaga em vez de marcar. */
  const jaMarcado = (slot: number) =>
    blocos.some(b => slot >= b.startMin && slot < b.endMin);

  const handleDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // No toque o arraste vertical é rolagem, e quem decide isso é o navegador
    // no início do gesto — por isso o dedo só pinta com o modo ligado, que
    // troca o touch-action da coluna antes de qualquer toque começar.
    if (e.button > 0) return;
    if (e.pointerType === "touch" && !pintar) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* segue sem captura */ }
    const slot = slotFromEvent(e);
    onDragStart(weekday, slot, jaMarcado(slot));
  };

  const preview = drag && drag.weekday === weekday ? dragRange(drag.anchor, drag.current) : null;

  return (
    <div
      className="relative select-none border-l border-border"
      style={{
        height: (RANGE.end - RANGE.start) / 60 * PX_PER_HOUR,
        touchAction: pintar ? "none" : "pan-y",
      }}
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
            aria-label={`${marcado ? "Liberar" : "Ocupar"} ${minutesToLabel(m)}`}
            onClick={() => onSlotClick(weekday, m, marcado)}
            className="absolute inset-x-0 border-b border-border/40 hover:bg-primary/5"
            style={{
              top: ((m - RANGE.start) / 60) * PX_PER_HOUR,
              height: (SLOT_MIN / 60) * PX_PER_HOUR,
            }}
          />
        );
      })}

      {/* Blocos ocupados */}
      {blocos.map(b => (
        <div
          key={`${b.startMin}-${b.endMin}`}
          className="pointer-events-none absolute inset-x-1 rounded-lg bg-rose-500/25 ring-1 ring-rose-500/60"
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
            drag?.apagando ? "border-emerald-500 bg-emerald-500/25" : "border-rose-500 bg-rose-500/30"
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

export default function BusyTimesTab() {
  const { unavailability, setMyUnavailabilityForDay } = useData();
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const [showWeekend, setShowWeekend] = useState(false);
  const [mobileDay, setMobileDay] = useState(() => {
    const hoje = new Date().getDay();
    return hoje === 0 || hoje === 6 ? 1 : hoje;
  });
  const [drag, setDrag] = useState<Drag | null>(null);
  const [pintar, setPintar] = useState(false);
  const dragEndedAt = useRef(0);

  const meus = useMemo(
    () => (user ? unavailability.filter(a => a.userId === user.id) : []),
    [unavailability, user],
  );

  const blocosDe = useCallback(
    (weekday: number) => (user ? unavailableOf(meus, user.id, weekday) : []),
    [meus, user],
  );

  /** Soma ou tira uma faixa dos meus horários ocupados daquele dia. */
  const aplicar = useCallback((weekday: number, faixa: Interval, apagando: boolean) => {
    if (!user) return;
    const atuais = unavailableOf(meus, user.id, weekday);
    const novos = apagando
      ? subtractIntervals(atuais, [faixa])
      : mergeIntervals([...atuais, faixa]);
    void setMyUnavailabilityForDay(weekday, novos);
  }, [user, meus, setMyUnavailabilityForDay]);

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

  const limparDia = (weekday: number) => { void setMyUnavailabilityForDay(weekday, []); };

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
            <CalendarX className="h-5 w-5 text-rose-500" />
            Meus horários ocupados
          </h2>
          <p className="text-sm text-muted-foreground">
            {!isMobile
              ? "Arraste para marcar quando você NÃO está livre — aula, estágio, trabalho. Arraste sobre um bloco vermelho para liberar."
              : pintar
                ? "Arraste o dedo na grade para marcar. Sobre um bloco vermelho, o arraste libera. Use a régua de horas à esquerda para rolar."
                : "Toque nas meias horas em que você NÃO está livre, ou ligue o arraste com o dedo."}
          </p>
        </div>
        {isMobile && (
          <button
            type="button"
            onClick={() => setPintar(v => !v)}
            aria-pressed={pintar}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
              pintar ? "bg-rose-500 text-white" : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            {pintar ? <Hand className="h-3.5 w-3.5" /> : <MoveVertical className="h-3.5 w-3.5" />}
            {pintar ? "Arrastando" : "Arrastar o dedo"}
          </button>
        )}
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
          {/* A régua fica sempre rolável: no modo de pintura, é por ela que se
              percorre o dia sem sair do modo */}
          <div
            className="relative"
            style={{
              height: (RANGE.end - RANGE.start) / 60 * PX_PER_HOUR,
              touchAction: "pan-y",
            }}
          >
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
              pintar={pintar}
            />
          ))}
        </div>
      </div>

      {totalBlocos === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center">
          <p className="text-sm font-medium text-foreground">
            Você ainda não marcou nenhum horário ocupado.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Enquanto estiver assim, na busca por horário você conta como livre a semana toda.
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Só você edita os seus horários. As outras pessoas do workspace conseguem
        vê-los para achar um horário em comum.
      </p>
    </div>
  );
}
