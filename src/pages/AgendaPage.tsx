import { useCallback, useMemo, useRef, useState } from "react";
import { CalendarCheck, CalendarClock, DoorOpen, Plus, Sparkles, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { AREAS, getAreaLabel } from "@/lib/areas";
import { isLeaderOfAny } from "@/lib/leadership";
import { Button } from "@/components/ui/button";
import MeetingModal from "@/components/modals/MeetingModal";
import MeetingRoomsModal from "@/components/modals/MeetingRoomsModal";
import AvailabilityTab from "@/components/agenda/AvailabilityTab";
import FindTimeTab from "@/components/agenda/FindTimeTab";
import {
  dragRange,
  durationLabel,
  gridRange,
  layoutDay,
  minutesToLabel,
  resolveParticipants,
  slotAtOffset,
  SLOT_MIN,
  WEEKDAYS,
  WEEKDAYS_UTEIS,
  type Meeting,
  type MeetingRoom,
} from "@/lib/agenda";

/** Altura de uma hora na grade, em pixels. Meia hora = metade disso. */
const PX_PER_HOUR = 64;
const NO_ROOM = "__sem_sala__";

type Range = { start: number; end: number };
type Drag = { weekday: number; anchor: number; current: number; moved: boolean };

/**
 * Onde o formulário deve abrir: dia, começo e — se veio de um arraste ou da
 * busca por horário — o fim e as pessoas já escolhidas.
 */
export type SlotSeed = {
  weekday: number;
  startMin: number;
  endMin?: number;
  personIds?: string[];
};

type Aba = "semana" | "disponibilidade" | "achar";

const ABAS: { key: Aba; label: string; icon: typeof CalendarClock }[] = [
  { key: "semana",          label: "Semana",           icon: CalendarClock },
  { key: "disponibilidade", label: "Minha disponibilidade", icon: CalendarCheck },
  // "Combinar" e não "Achar horário": dentro da aba existe o botão com esse
  // nome, e dois controles com o mesmo rótulo confundem
  { key: "achar",           label: "Combinar horário", icon: Sparkles },
];

// --- Subcomponentes -----------------------------------------------------
// Ficam fora do AgendaPage de propósito: definidos lá dentro, cada render
// criaria um tipo novo e o React remontaria a grade inteira — o que zeraria o
// arraste no meio do gesto.

function MeetingBlock({
  m, lane, lanes, range, canManage, color, room, subtitle, onEdit,
}: {
  m: Meeting; lane: number; lanes: number; range: Range; canManage: boolean;
  color: string; room: MeetingRoom | null; subtitle: string;
  onEdit: (m: Meeting) => void;
}) {
  const top = ((m.startMin - range.start) / 60) * PX_PER_HOUR;
  const height = Math.max(((m.endMin - m.startMin) / 60) * PX_PER_HOUR - 3, 22);
  const compact = height < 46;

  return (
    <button
      type="button"
      onClick={() => onEdit(m)}
      disabled={!canManage}
      title={`${m.title} · ${minutesToLabel(m.startMin)}–${minutesToLabel(m.endMin)}${room ? ` · ${room.name}` : ""}`}
      className="absolute overflow-hidden rounded-lg border-l-4 px-2 py-1 text-left transition-shadow hover:shadow-lg disabled:cursor-default"
      style={{
        top, height,
        left: `calc(${(100 / lanes) * lane}% + 2px)`,
        width: `calc(${100 / lanes}% - 4px)`,
        borderLeftColor: color,
        backgroundColor: `${color}22`,
      }}
    >
      <span className="block truncate text-xs font-bold leading-tight text-foreground">
        {m.title}
      </span>
      {!compact && (
        <>
          <span className="block truncate text-[11px] leading-tight text-muted-foreground">
            {minutesToLabel(m.startMin)}–{minutesToLabel(m.endMin)}
          </span>
          <span className="block truncate text-[11px] leading-tight text-muted-foreground">
            {subtitle}{room ? ` · ${room.name}` : ""}
          </span>
        </>
      )}
    </button>
  );
}

function DayColumn({
  weekday, list, range, canManage, drag,
  onDragStart, onDragMove, onDragEnd, onOpenNew, onEdit,
  colorOf, roomOf, subtitleOf,
}: {
  weekday: number; list: Meeting[]; range: Range; canManage: boolean;
  drag: Drag | null;
  onDragStart: (weekday: number, slot: number) => void;
  onDragMove: (weekday: number, slot: number) => void;
  onDragEnd: (weekday: number) => void;
  onOpenNew: (weekday: number, startMin: number) => void;
  onEdit: (m: Meeting) => void;
  colorOf: (m: Meeting) => string;
  roomOf: (m: Meeting) => MeetingRoom | null;
  subtitleOf: (m: Meeting) => string;
}) {
  const lanesMap = layoutDay(list);
  const slots: number[] = [];
  for (let m = range.start; m < range.end; m += SLOT_MIN) slots.push(m);

  /** Horário sob o ponteiro, medido a partir do topo desta coluna. */
  const slotFromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return slotAtOffset(e.clientY - rect.top, range, PX_PER_HOUR);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Só arrasta com mouse/caneta: no toque o gesto vertical é rolagem
    // e.button > 0 = botão direito/meio. Comparar com !== 0 recusaria o
    // gesto onde o campo não vem preenchido.
    if (!canManage || e.pointerType === "touch" || e.button > 0) return;
    // Segura o ponteiro para o arraste continuar mesmo saindo da coluna.
    // Nem todo ambiente implementa a captura, e falhar nela não é motivo
    // para perder o gesto.
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* segue sem captura */ }
    onDragStart(weekday, slotFromEvent(e));
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag || drag.weekday !== weekday) return;
    onDragMove(weekday, slotFromEvent(e));
  };

  const handlePointerUp = () => {
    if (!drag || drag.weekday !== weekday) return;
    onDragEnd(weekday);
  };

  // Faixa translúcida mostrando o que está sendo selecionado
  const preview = drag && drag.weekday === weekday ? dragRange(drag.anchor, drag.current) : null;

  return (
    <div
      className="relative select-none border-l border-border"
      style={{ height: (range.end - range.start) / 60 * PX_PER_HOUR, touchAction: "pan-y" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {slots.map(m => (
        <button
          key={m}
          type="button"
          onClick={() => onOpenNew(weekday, m)}
          disabled={!canManage}
          aria-label={`Marcar reunião às ${minutesToLabel(m)}`}
          className="absolute inset-x-0 border-b border-border/40 transition-colors hover:bg-primary/5 disabled:cursor-default disabled:hover:bg-transparent"
          style={{
            top: ((m - range.start) / 60) * PX_PER_HOUR,
            height: (SLOT_MIN / 60) * PX_PER_HOUR,
          }}
        />
      ))}

      {list.map(m => {
        const l = lanesMap.get(m.id) ?? { lane: 0, lanes: 1 };
        return (
          <MeetingBlock
            key={m.id}
            m={m} lane={l.lane} lanes={l.lanes} range={range} canManage={canManage}
            color={colorOf(m)} room={roomOf(m)} subtitle={subtitleOf(m)}
            onEdit={onEdit}
          />
        );
      })}

      {preview && (
        <div
          className="pointer-events-none absolute inset-x-1 rounded-lg border-2 border-primary bg-primary/20"
          style={{
            top: ((preview.startMin - range.start) / 60) * PX_PER_HOUR,
            height: ((preview.endMin - preview.startMin) / 60) * PX_PER_HOUR,
          }}
        >
          <span className="block px-1.5 py-0.5 text-[11px] font-bold text-foreground">
            {minutesToLabel(preview.startMin)}–{minutesToLabel(preview.endMin)}
          </span>
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active, onClick, children, color,
}: {
  active: boolean; onClick: () => void; children: React.ReactNode; color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
      }`}
    >
      {color && (
        <span
          className="mr-1.5 h-2 w-2 rounded-full"
          style={{ backgroundColor: active ? "currentColor" : color }}
        />
      )}
      {children}
    </button>
  );
}

// --- Página -------------------------------------------------------------

export default function AgendaPage() {
  const { people, teams, meetings, meetingRooms } = useData();
  const { isAdmin, user } = useAuth();
  const isMobile = useIsMobile();

  // Diretores e líderes marcam reuniões; o resto só consulta
  const canManage = isAdmin || isLeaderOfAny(people, user?.id);

  const [roomFilter, setRoomFilter] = useState<string | null>(null);
  const [showWeekend, setShowWeekend] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);
  const [mobileDay, setMobileDay] = useState(() => {
    const today = new Date().getDay();
    return today === 0 || today === 6 ? 1 : today;
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [seed, setSeed] = useState<SlotSeed | null>(null);
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [aba, setAba] = useState<Aba>("semana");
  // Quando o arraste terminou. O navegador dispara um clique logo depois, e
  // ele reabriria o formulário perdendo o intervalo escolhido. Guardamos o
  // instante em vez de uma trava booleana: uma trava ficaria presa quando o
  // clique não vem (soltar fora de um espaço vago) e engoliria o clique
  // seguinte, esse de verdade.
  const dragEndedAt = useRef(0);

  const myPersonIds = useMemo(
    () => new Set(people.filter(p => p.userId === user?.id).map(p => p.id)),
    [people, user?.id],
  );

  const visible = useMemo(() => {
    return meetings.filter(m => {
      if (roomFilter === NO_ROOM && m.roomId !== null) return false;
      if (roomFilter && roomFilter !== NO_ROOM && m.roomId !== roomFilter) return false;
      if (onlyMine) {
        const ids = resolveParticipants(m, { people, teams });
        if (!ids.some(id => myPersonIds.has(id))) return false;
      }
      return true;
    });
  }, [meetings, roomFilter, onlyMine, people, teams, myPersonIds]);

  const days = showWeekend ? WEEKDAYS : WEEKDAYS_UTEIS;
  const range = useMemo(() => gridRange(visible), [visible]);

  const hourMarks = useMemo(() => {
    const out: number[] = [];
    for (let m = range.start; m <= range.end; m += 60) out.push(m);
    return out;
  }, [range]);

  const byDay = useMemo(() => {
    const map = new Map<number, Meeting[]>();
    for (const d of WEEKDAYS) map.set(d.key, []);
    for (const m of visible) map.get(m.weekday)?.push(m);
    return map;
  }, [visible]);

  const openForm = useCallback((s: SlotSeed) => {
    setEditing(null);
    setSeed(s);
    setModalOpen(true);
  }, []);

  const openNew = useCallback((weekday: number, startMin: number) => {
    if (!canManage) return;
    if (Date.now() - dragEndedAt.current < 300) return;
    // Um clique vale o retângulo em que se clicou: meia hora
    openForm({ weekday, startMin, endMin: startMin + SLOT_MIN });
  }, [canManage, openForm]);

  const openEdit = useCallback((m: Meeting) => {
    if (!canManage) return;
    setEditing(m);
    setSeed(null);
    setModalOpen(true);
  }, [canManage]);

  // --- Arraste para escolher o intervalo ---
  const onDragStart = useCallback((weekday: number, slot: number) => {
    setDrag({ weekday, anchor: slot, current: slot, moved: false });
  }, []);

  const onDragMove = useCallback((weekday: number, slot: number) => {
    setDrag(d => (d && d.weekday === weekday && d.current !== slot)
      ? { ...d, current: slot, moved: true }
      : d);
  }, []);

  const onDragEnd = useCallback((weekday: number) => {
    // Abrir o formulário de dentro de um updater de estado seria um efeito
    // colateral numa função que precisa ser pura
    if (drag && drag.weekday === weekday && drag.moved) {
      const { startMin, endMin } = dragRange(drag.anchor, drag.current);
      dragEndedAt.current = Date.now();
      openForm({ weekday, startMin, endMin });
    }
    setDrag(null);
  }, [drag, openForm]);

  const roomOf = useCallback(
    (m: Meeting) => meetingRooms.find(r => r.id === m.roomId) ?? null,
    [meetingRooms],
  );

  const colorOf = useCallback((m: Meeting) => {
    const room = roomOf(m);
    if (room) return room.color;
    if (m.targetType === "area") return AREAS.find(a => a.key === m.targetValue)?.color ?? "#64748B";
    return "#64748B";
  }, [roomOf]);

  const subtitleOf = useCallback((m: Meeting) => {
    if (m.targetType === "team") return teams.find(t => t.id === m.targetValue)?.name ?? "Time";
    if (m.targetType === "area") return getAreaLabel(m.targetValue ?? "");
    const n = m.personIds.length;
    return `${n} ${n === 1 ? "pessoa" : "pessoas"}`;
  }, [teams]);

  const shownDays = isMobile ? WEEKDAYS.filter(d => d.key === mobileDay) : days;
  const gridCols = `56px repeat(${shownDays.length}, minmax(0, 1fr))`;

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <CalendarClock className="h-6 w-6 text-primary" />
            Agenda
          </h1>
          <p className="text-sm text-muted-foreground">
            {aba !== "semana"
              ? "Combine horários sem ficar perguntando um por um."
              : canManage && !isMobile
                ? "Arraste na grade para escolher o horário. Um clique marca meia hora."
                : "As reuniões da semana se repetem toda semana."}
          </p>
        </div>
        {isAdmin && aba === "semana" && (
          <Button variant="outline" onClick={() => setRoomsOpen(true)} className="rounded-xl">
            <DoorOpen className="mr-1.5 h-4 w-4" />
            Salas
          </Button>
        )}
        {canManage && aba === "semana" && (
          <Button
            onClick={() => openForm({ weekday: isMobile ? mobileDay : 1, startMin: 14 * 60 })}
            className="rounded-xl font-bold"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Nova reunião
          </Button>
        )}
      </div>

      {/* Abas */}
      <div className="flex gap-1.5 overflow-x-auto border-b border-border pb-2">
        {ABAS.map(a => {
          const Icone = a.icon;
          return (
            <button
              key={a.key}
              type="button"
              onClick={() => setAba(a.key)}
              aria-current={aba === a.key ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ${
                aba === a.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              <Icone className="h-4 w-4" />
              {a.label}
            </button>
          );
        })}
      </div>

      {aba === "disponibilidade" && <AvailabilityTab />}

      {aba === "achar" && (
        <FindTimeTab
          onMarcar={s => { setAba("semana"); openForm(s); }}
        />
      )}

      {aba === "semana" && (
      <>
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-1.5">
        <FilterChip active={roomFilter === null} onClick={() => setRoomFilter(null)}>
          Todas as salas
        </FilterChip>
        {meetingRooms.map(r => (
          <FilterChip key={r.id} active={roomFilter === r.id} onClick={() => setRoomFilter(r.id)} color={r.color}>
            {r.name}
          </FilterChip>
        ))}
        <FilterChip active={roomFilter === NO_ROOM} onClick={() => setRoomFilter(NO_ROOM)}>
          Sem sala
        </FilterChip>

        <span className="mx-1 hidden h-5 w-px bg-border sm:block" />

        <FilterChip active={onlyMine} onClick={() => setOnlyMine(v => !v)}>
          <Users className="mr-1 inline h-3.5 w-3.5" />
          Minhas
        </FilterChip>
        {!isMobile && (
          <FilterChip active={showWeekend} onClick={() => setShowWeekend(v => !v)}>
            Fim de semana
          </FilterChip>
        )}
      </div>

      {/* Dias no celular */}
      {isMobile && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {WEEKDAYS.map(d => (
            <FilterChip key={d.key} active={mobileDay === d.key} onClick={() => setMobileDay(d.key)}>
              {d.short}
            </FilterChip>
          ))}
        </div>
      )}

      {/* Grade */}
      <div className="glass-panel overflow-hidden rounded-2xl">
        <div className="grid border-b border-border bg-card/60" style={{ gridTemplateColumns: gridCols }}>
          <div />
          {shownDays.map(d => {
            const n = (byDay.get(d.key) ?? []).length;
            return (
              <div key={d.key} className="border-l border-border px-2 py-2 text-center">
                <span className="text-sm font-bold text-foreground">
                  {isMobile ? d.label : d.short}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  {n} {n === 1 ? "reunião" : "reuniões"}
                </span>
              </div>
            );
          })}
        </div>

        <div className="grid overflow-x-auto" style={{ gridTemplateColumns: gridCols }}>
          {/* Régua de horas */}
          <div className="relative" style={{ height: (range.end - range.start) / 60 * PX_PER_HOUR }}>
            {hourMarks.map(m => (
              <span
                key={m}
                className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-muted-foreground"
                style={{ top: ((m - range.start) / 60) * PX_PER_HOUR }}
              >
                {minutesToLabel(m)}
              </span>
            ))}
          </div>

          {shownDays.map(d => (
            <DayColumn
              key={d.key}
              weekday={d.key}
              list={byDay.get(d.key) ?? []}
              range={range}
              canManage={canManage}
              drag={drag}
              onDragStart={onDragStart}
              onDragMove={onDragMove}
              onDragEnd={onDragEnd}
              onOpenNew={openNew}
              onEdit={openEdit}
              colorOf={colorOf}
              roomOf={roomOf}
              subtitleOf={subtitleOf}
            />
          ))}
        </div>
      </div>

      {/* Vazio */}
      {visible.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <CalendarClock className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium text-foreground">
            {meetings.length === 0 ? "Nenhuma reunião marcada ainda." : "Nenhuma reunião com esses filtros."}
          </p>
          {canManage && meetings.length === 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              {isMobile
                ? "Toque em um horário da grade para marcar a primeira."
                : "Arraste do horário de início ao de fim para marcar a primeira."}
            </p>
          )}
        </div>
      )}

      {/* Resumo por dia */}
      {visible.length > 0 && (
        <div className="space-y-2">
          {shownDays.map(d => {
            const list = [...(byDay.get(d.key) ?? [])].sort((a, b) => a.startMin - b.startMin);
            if (!list.length) return null;
            return (
              <div key={d.key} className="glass-panel rounded-2xl p-3">
                <h2 className="mb-2 text-sm font-bold text-foreground">{d.label}</h2>
                <div className="space-y-1.5">
                  {list.map(m => {
                    const room = roomOf(m);
                    const n = resolveParticipants(m, { people, teams }).length;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => openEdit(m)}
                        disabled={!canManage}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-accent disabled:cursor-default disabled:hover:bg-transparent"
                      >
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorOf(m) }} />
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {minutesToLabel(m.startMin)}–{minutesToLabel(m.endMin)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                          {m.title}
                        </span>
                        <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                          {subtitleOf(m)} · {n} {n === 1 ? "pessoa" : "pessoas"}
                          {room ? ` · ${room.name}` : ""} · {durationLabel(m.startMin, m.endMin)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      </>
      )}

      <MeetingModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        meeting={editing}
        initial={seed}
      />
      <MeetingRoomsModal open={roomsOpen} onOpenChange={setRoomsOpen} />
    </div>
  );
}
