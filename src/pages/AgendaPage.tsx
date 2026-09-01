import { useMemo, useState } from "react";
import { CalendarClock, DoorOpen, Plus, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { AREAS, getAreaLabel } from "@/lib/areas";
import { isLeaderOfAny } from "@/lib/leadership";
import { Button } from "@/components/ui/button";
import MeetingModal from "@/components/modals/MeetingModal";
import MeetingRoomsModal from "@/components/modals/MeetingRoomsModal";
import {
  durationLabel,
  gridRange,
  layoutDay,
  minutesToLabel,
  resolveParticipants,
  SLOT_MIN,
  WEEKDAYS,
  WEEKDAYS_UTEIS,
  type Meeting,
} from "@/lib/agenda";

/** Altura de uma hora na grade, em pixels. Meia hora = metade disso. */
const PX_PER_HOUR = 64;
const NO_ROOM = "__sem_sala__";

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
  const [initialSlot, setInitialSlot] = useState<{ weekday: number; startMin: number } | null>(null);
  const [roomsOpen, setRoomsOpen] = useState(false);

  // Ids das pessoas ligadas à minha conta (posso ter mais de um registro)
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
  const totalMin = range.end - range.start;
  const gridHeight = (totalMin / 60) * PX_PER_HOUR;

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

  const openNew = (weekday: number, startMin: number) => {
    if (!canManage) return;
    setEditing(null);
    setInitialSlot({ weekday, startMin });
    setModalOpen(true);
  };

  const openEdit = (m: Meeting) => {
    if (!canManage) return;
    setEditing(m);
    setInitialSlot(null);
    setModalOpen(true);
  };

  const roomOf = (m: Meeting) => meetingRooms.find(r => r.id === m.roomId) ?? null;

  const colorOf = (m: Meeting) => {
    const room = roomOf(m);
    if (room) return room.color;
    if (m.targetType === "area") return AREAS.find(a => a.key === m.targetValue)?.color ?? "#64748B";
    return "#64748B";
  };

  const subtitleOf = (m: Meeting) => {
    if (m.targetType === "team") return teams.find(t => t.id === m.targetValue)?.name ?? "Time";
    if (m.targetType === "area") return getAreaLabel(m.targetValue ?? "");
    const n = m.personIds.length;
    return `${n} ${n === 1 ? "pessoa" : "pessoas"}`;
  };

  /** Bloco da reunião posicionado na coluna do dia. */
  const MeetingBlock = ({ m, lane, lanes }: { m: Meeting; lane: number; lanes: number }) => {
    const top = ((m.startMin - range.start) / 60) * PX_PER_HOUR;
    const height = Math.max(((m.endMin - m.startMin) / 60) * PX_PER_HOUR - 3, 22);
    const color = colorOf(m);
    const room = roomOf(m);
    const width = `calc(${100 / lanes}% - 4px)`;
    const left = `calc(${(100 / lanes) * lane}% + 2px)`;
    const compact = height < 46;

    return (
      <button
        type="button"
        onClick={() => openEdit(m)}
        disabled={!canManage}
        title={`${m.title} · ${minutesToLabel(m.startMin)}–${minutesToLabel(m.endMin)}${room ? ` · ${room.name}` : ""}`}
        className="absolute overflow-hidden rounded-lg border-l-4 px-2 py-1 text-left transition-shadow hover:shadow-lg disabled:cursor-default"
        style={{
          top,
          height,
          left,
          width,
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
              {subtitleOf(m)}{room ? ` · ${room.name}` : ""}
            </span>
          </>
        )}
      </button>
    );
  };

  /** Coluna de um dia: fundo clicável de 30 em 30 min + blocos por cima. */
  const DayColumn = ({ weekday }: { weekday: number }) => {
    const list = byDay.get(weekday) ?? [];
    const lanesMap = layoutDay(list);
    const slots: number[] = [];
    for (let m = range.start; m < range.end; m += SLOT_MIN) slots.push(m);

    return (
      <div className="relative border-l border-border" style={{ height: gridHeight }}>
        {slots.map(m => (
          <button
            key={m}
            type="button"
            onClick={() => openNew(weekday, m)}
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
          return <MeetingBlock key={m.id} m={m} lane={l.lane} lanes={l.lanes} />;
        })}
      </div>
    );
  };

  const shownDays = isMobile ? WEEKDAYS.filter(d => d.key === mobileDay) : days;

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
            As reuniões da semana se repetem toda semana.
          </p>
        </div>
        {isAdmin && (
          <Button variant="outline" onClick={() => setRoomsOpen(true)} className="rounded-xl">
            <DoorOpen className="mr-1.5 h-4 w-4" />
            Salas
          </Button>
        )}
        {canManage && (
          <Button
            onClick={() => openNew(isMobile ? mobileDay : 1, 14 * 60)}
            className="rounded-xl font-bold"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Nova reunião
          </Button>
        )}
      </div>

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
        {/* Cabeçalho dos dias */}
        <div
          className="grid border-b border-border bg-card/60"
          style={{ gridTemplateColumns: `56px repeat(${shownDays.length}, minmax(0, 1fr))` }}
        >
          <div />
          {shownDays.map(d => (
            <div key={d.key} className="border-l border-border px-2 py-2 text-center">
              <span className="text-sm font-bold text-foreground">
                {isMobile ? d.label : d.short}
              </span>
              <span className="block text-[11px] text-muted-foreground">
                {(byDay.get(d.key) ?? []).length} {(byDay.get(d.key) ?? []).length === 1 ? "reunião" : "reuniões"}
              </span>
            </div>
          ))}
        </div>

        {/* Horas + colunas */}
        <div
          className="grid overflow-x-auto"
          style={{ gridTemplateColumns: `56px repeat(${shownDays.length}, minmax(0, 1fr))` }}
        >
          {/* Régua de horas */}
          <div className="relative" style={{ height: gridHeight }}>
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

          {shownDays.map(d => <DayColumn key={d.key} weekday={d.key} />)}
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
              Toque em um horário da grade para marcar a primeira.
            </p>
          )}
        </div>
      )}

      {/* Lista do dia — resumo legível abaixo da grade */}
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

      <MeetingModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        meeting={editing}
        initial={initialSlot}
      />
      <MeetingRoomsModal open={roomsOpen} onOpenChange={setRoomsOpen} />
    </div>
  );
}

function FilterChip({
  active, onClick, children, color,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: string;
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
