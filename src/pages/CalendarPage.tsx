import { useState, useMemo, useRef, useEffect, type DragEvent } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ChevronLeft, ChevronRight, Plus, X, ChevronUp, ChevronDown, CalendarDays, User, CheckCircle2, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import type { Task, Post, CalendarEvent } from "@/contexts/DataContext";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth,
  addMonths, subMonths, isToday, isSameDay,
  startOfWeek, endOfWeek, addDays, isTomorrow,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import TaskModal from "@/components/modals/TaskModal";
import PostModal from "@/components/modals/PostModal";
import EventModal from "@/components/modals/EventModal";
import IdeaModal from "@/components/modals/IdeaModal";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import { toast } from "sonner";
import { getNowBrasilia } from "@/lib/utils";
import { normalizeToISODate } from "@/lib/demandStatus";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLongPressDrag, type DragDropResult } from "@/hooks/useLongPressDrag";
import { AREAS, getTeamColor, getAreaColor, getAreaLabel, getTeamIdFromAreaKey } from "@/lib/areas";
import { isLeaderOfAny } from "@/lib/leadership";
import trashBinImg from "@/assets/trash-bin.png";

function sameAreaOrTeam(left?: string | null, right?: string | null) {
  if (!left || !right) return left === right;
  const leftTeamId = getTeamIdFromAreaKey(left);
  const rightTeamId = getTeamIdFromAreaKey(right);
  if (leftTeamId || rightTeamId) {
    return !!leftTeamId && !!rightTeamId && leftTeamId.toLowerCase() === rightTeamId.toLowerCase();
  }
  return left === right;
}

export type CalendarItem = {
  id: string; title: string; type: "task" | "post" | "event";
  date: string; time?: string; color: string; status?: string;
  eventTypeName?: string;
  scopeLabel?: string;
  responsibleName?: string;
  /** Subtype for "event"-rendered parking items so drop logic can detect them. */
  parkingId?: string;
  isDemand?: boolean;
};


const TASK_COLOR = "#E8804A"; // laranja
const POST_COLOR = "#3B7DD8"; // azul (Marketing)
const EVENT_FALLBACK_COLOR = "#2E9E6E"; // verde médio

const POST_STATUS_ORDER = ["not-started", "in-progress", "done", "published"] as const;
const POST_STATUS_META: Record<string, { label: string; color: string }> = {
  "not-started": { label: "Não publicado", color: "#9CA3AF" },
  "in-progress": { label: "Em andamento", color: "#F59E0B" },
  "done":        { label: "Pronto",        color: "#10B981" },
  "published":   { label: "Publicado",     color: "#3B82F6" },
};
const CALENDAR_FILTER_PREFERENCES_PREFIX = "buzzup.calendar.filters";

const nextPostStatus = (s?: string) => {
  const current = POST_STATUS_ORDER.includes(s as (typeof POST_STATUS_ORDER)[number])
    ? s as (typeof POST_STATUS_ORDER)[number]
    : "not-started";
  const i = POST_STATUS_ORDER.indexOf(current);
  return POST_STATUS_ORDER[(i + 1) % POST_STATUS_ORDER.length];
};

function getDemandCalendarVisual(item: CalendarItem, todayStr: string) {
  if (!item.isDemand) return null;
  if (item.status === "done") {
    return { kind: "done" as const, color: "#10B981", label: "Concluída" };
  }
  const iso = normalizeToISODate(item.date);
  if (iso && iso < todayStr) {
    return { kind: "overdue" as const, color: "#EF4444", label: "Atrasada" };
  }
  return { kind: "progress" as const, color: "#F97316", label: "Em andamento" };
}

function getCalendarOrder(item: CalendarItem, todayStr: string) {
  const visual = getDemandCalendarVisual(item, todayStr);
  if (visual?.kind === "overdue") return 0;
  if (visual?.kind === "progress") return 1;
  if (visual?.kind === "done") return 2;
  return 3;
}

function sortCalendarItems(items: CalendarItem[], todayStr: string) {
  return [...items].sort((a, b) => {
    const byStatus = getCalendarOrder(a, todayStr) - getCalendarOrder(b, todayStr);
    if (byStatus !== 0) return byStatus;
    const byTime = (a.time || "99:99").localeCompare(b.time || "99:99");
    if (byTime !== 0) return byTime;
    return a.title.localeCompare(b.title);
  });
}

// Toggle estilo switch usado na organização de demandas (Minhas demandas / Concluídas)
function CalToggle({ active, onClick, icon: Icon, label, activeColor = "#00B4D8" }: {
  active: boolean; onClick: () => void; icon: LucideIcon; label: string; activeColor?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="switch"
      aria-checked={active}
      title={label}
      className={`flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 rounded-xl border text-xs font-medium transition-all ${
        active ? "text-white shadow-sm" : "bg-background text-muted-foreground border-border hover:text-foreground hover:border-foreground/30"
      }`}
      style={active ? { backgroundColor: activeColor, borderColor: activeColor } : undefined}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="whitespace-nowrap">{label}</span>
      <span className={`ml-0.5 h-4 w-7 rounded-full flex items-center p-0.5 transition-colors ${active ? "bg-white/30" : "bg-muted"}`}>
        <span className={`h-3 w-3 rounded-full bg-white shadow transition-transform ${active ? "translate-x-3" : ""}`} />
      </span>
    </button>
  );
}

export default function CalendarPage() {
  const { tasks, posts, events, eventTypes, parkingItems, teams, people, updateTask, updatePost, updateEvent, deleteTask, deletePost, deleteEvent, addParkingItem, updateParkingItem, deleteParkingItem } = useData();
  const { isAdmin: _isAdmin, user, activeWorkspaceId } = useAuth();
  // No calendário, líderes de qualquer área/time podem editar (mover, criar, status).
  // Sombreamos isAdmin para que todas as checagens existentes incluam líderes.
  const isAdmin = _isAdmin || isLeaderOfAny(people, user?.id);
  const isMobile = useIsMobile();
  const [currentDate, setCurrentDate] = useState(getNowBrasilia());
  const [filterArea, setFilterArea] = useState<string | null>(null);
  const [newIdea, setNewIdea] = useState("");
  const [parkingDropActive, setParkingDropActive] = useState(false);
  const newIdeaRef = useRef<HTMLInputElement>(null);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  // Organização de demandas: "Minhas demandas" e "Mostrar concluídas"
  const [onlyMine, setOnlyMine] = useState(false);
  const [showDone, setShowDone] = useState(true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [loadedPreferenceKey, setLoadedPreferenceKey] = useState<string | null>(null);
  const calendarPreferenceKey = user?.id && activeWorkspaceId
    ? `${CALENDAR_FILTER_PREFERENCES_PREFIX}.${activeWorkspaceId}.${user.id}`
    : null;

  useEffect(() => {
    setLoadedPreferenceKey(null);
    if (!calendarPreferenceKey) return;

    let nextOnlyMine = false;
    let nextShowDone = true;
    try {
      const stored = localStorage.getItem(calendarPreferenceKey);
      if (stored) {
        const preferences = JSON.parse(stored) as { onlyMine?: unknown; showDone?: unknown };
        if (typeof preferences.onlyMine === "boolean") nextOnlyMine = preferences.onlyMine;
        if (typeof preferences.showDone === "boolean") nextShowDone = preferences.showDone;
      }
    } catch {
      // Preferências inválidas ou armazenamento indisponível: usa os padrões seguros.
    }

    setOnlyMine(nextOnlyMine);
    setShowDone(nextShowDone);
    setLoadedPreferenceKey(calendarPreferenceKey);
  }, [calendarPreferenceKey]);

  useEffect(() => {
    if (!calendarPreferenceKey || loadedPreferenceKey !== calendarPreferenceKey) return;
    try {
      localStorage.setItem(calendarPreferenceKey, JSON.stringify({ onlyMine, showDone }));
    } catch {
      // O calendário continua funcional mesmo se o navegador bloquear o armazenamento.
    }
  }, [calendarPreferenceKey, loadedPreferenceKey, onlyMine, showDone]);
  const calendarTodayStr = format(getNowBrasilia(), "yyyy-MM-dd");

  // IDs das pessoas vinculadas ao usuário logado (uma conta pode ter mais de um registro)
  const myPersonIds = useMemo(() => {
    if (!user) return new Set<string>();
    return new Set(people.filter(p => p.userId === user.id).map(p => p.id));
  }, [user, people]);
  const isMineTask = (t: Task) => t.responsible?.some(r => myPersonIds.has(r.id));
  const isMineParking = (personId: string | null) => !!personId && myPersonIds.has(personId);

  const [taskModal, setTaskModal] = useState<{ open: boolean; task?: Task | null; date?: string }>({ open: false });
  const [postModal, setPostModal] = useState<{ open: boolean; post?: Post | null; date?: string }>({ open: false });
  const [eventModal, setEventModal] = useState<{ open: boolean; event?: CalendarEvent | null; date?: string }>({ open: false });
  const [ideaModal, setIdeaModal] = useState<{ open: boolean; item: import("@/contexts/DataContext").ParkingItem | null; defaultDate?: string; defaultArea?: string; requireFull?: boolean }>({ open: false, item: null });
  const [deleting, setDeleting] = useState<{ open: boolean; id: string; title: string; type: string; parkingId?: string }>({ open: false, id: "", title: "", type: "" });

  const [tooltipState, setTooltipState] = useState<{ item: CalendarItem; rect: DOMRect } | null>(null);

  const [dragItem, setDragItem] = useState<CalendarItem | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [trashActive, setTrashActive] = useState(false);
  const [shrinkingId, setShrinkingId] = useState<string | null>(null);
  // Popup com todas as demandas de um dia (mobile)
  const [dayPopup, setDayPopup] = useState<string | null>(null);

  const performTrashDelete = (item: CalendarItem) => {
    setShrinkingId(item.id);
    setTrashActive(false);
    setTimeout(() => {
      if (item.parkingId) {
        deleteParkingItem(item.parkingId);
      } else if (item.type === "task") deleteTask(item.id);
      else if (item.type === "post") deletePost(item.id);
      else if (item.type === "event") deleteEvent(item.id);
      setShrinkingId(null);
      setDragItem(null);
      toast.success("Item excluído");
    }, 420);
  };

  const handleTrashDragOver = (e: DragEvent) => {
    if (!isAdmin) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setTrashActive((cur) => (cur ? cur : true));
  };
  const handleTrashDragLeave = () => setTrashActive((cur) => (cur ? false : cur));
  const handleTrashDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAdmin) { setTrashActive(false); setDragItem(null); return; }
    const droppedItem = dragItem ?? (() => {
      try { return JSON.parse(e.dataTransfer.getData("text/plain")) as CalendarItem; } catch { return null; }
    })();
    if (!droppedItem) { setTrashActive(false); return; }
    performTrashDelete(droppedItem);
  };

  const activeAreaMeta = filterArea
    ? (getTeamIdFromAreaKey(filterArea)
      ? {
          key: filterArea,
          label: teams.find(t => sameAreaOrTeam(`team_${t.id}`, filterArea))?.name || "Time",
          color: getTeamColor(getTeamIdFromAreaKey(filterArea)!),
        }
      : AREAS.find(a => a.key === filterArea))
    : null;
  // All ideas without a date — always shown in sidebar regardless of area filter.
  const parkedIdeas = useMemo(() => {
    let ideas = parkingItems.filter(p => !p.date);
    if (onlyMine) ideas = ideas.filter(p => isMineParking(p.personId)); // "Minhas demandas"
    // When a filter is active, sort: matching area/team first, others below
    if (filterArea) {
      const matching = ideas.filter(p => sameAreaOrTeam(p.area, filterArea));
      const others = ideas.filter(p => !sameAreaOrTeam(p.area, filterArea));
      return [...matching, ...others];
    }
    return ideas;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parkingItems, filterArea, onlyMine, myPersonIds]);

  const applyDrop = (item: CalendarItem, target: DragDropResult) => {
    if (!isAdmin) { toast.error("Apenas diretores podem alterar datas"); return; }
    if (target.kind === "none") return;
    if (target.kind === "parking") {
      if (item.parkingId) {
        const pk = parkingItems.find(p => p.id === item.parkingId);
        if (pk) { updateParkingItem({ ...pk, date: "", personId: null }); toast.success("Demanda devolvida ao Papel"); }
        return;
      }
      if (item.type === "post") {
        const post = posts.find(p => p.id === item.id);
        if (post) { updatePost({ ...post, date: "", time: "" }); toast.success("Publicação estacionada"); }
        return;
      }
      toast.error("Apenas ideias e publicações podem ser estacionadas"); return;
    }
    // day drop
    const dayStr = target.date;
    if (item.parkingId) { dropParkingOnDate(item.parkingId, dayStr); return; }
    if (item.type === "task") { const task = tasks.find(t => t.id === item.id); if (task) updateTask({ ...task, deadline: dayStr }); }
    else if (item.type === "post") { const post = posts.find(p => p.id === item.id); if (post) updatePost({ ...post, date: dayStr }); }
    else if (item.type === "event") { const ev = events.find(e => e.id === item.id); if (ev) updateEvent({ ...ev, date: dayStr }); }
  };

  // Drop a parking item onto a date. If it has area + responsável, update directly.
  // Otherwise open the IdeaModal in "requireFull" mode so the user completes it before scheduling.
  const dropParkingOnDate = (parkingId: string, dayStr: string) => {
    const pk = parkingItems.find(p => p.id === parkingId);
    if (!pk) return;
    if (pk.area) {
      // Has area — schedule directly (with or without responsible)
      updateParkingItem({ ...pk, date: dayStr });
      toast.success("Demanda agendada");
    } else {
      // No area — open modal to complete
      setIdeaModal({ open: true, item: pk, defaultDate: dayStr, defaultArea: filterArea || pk.area || "", requireFull: true });
    }
  };

  const longPress = useLongPressDrag<CalendarItem>({
    delay: 200,
    enabled: isAdmin,
    onDrop: (item, target) => applyDrop(item, target),
  });

  const handleQuickIdea = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newIdea.trim();
    if (!title) return;
    if (!filterArea) {
      toast.error("Selecione uma área ou time no filtro antes de criar uma ideia");
      return;
    }
    addParkingItem(filterArea, title, "");
    toast.success(`Ideia adicionada em ${activeAreaMeta?.label}`);
    setNewIdea("");
    setTimeout(() => newIdeaRef.current?.focus(), 0);
  };

  const cyclePostStatus = (postId: string) => {
    const p = posts.find(x => x.id === postId);
    if (!p) return;
    const ns = nextPostStatus(p.status);
    updatePost({ ...p, status: ns });
    toast.success(`Status: ${POST_STATUS_META[ns].label}`);
  };

  const handleDelete = () => {
    if (deleting.parkingId) deleteParkingItem(deleting.parkingId);
    else if (deleting.type === "task") deleteTask(deleting.id);
    else if (deleting.type === "post") deletePost(deleting.id);
    else if (deleting.type === "event") deleteEvent(deleting.id);
    toast.success("Item excluído");
  };

  const allItems = useMemo<CalendarItem[]>(() => {
    const items: CalendarItem[] = [];
    tasks.forEach((t) => {
      if (t.status === "done") return; // demandas concluídas não aparecem no calendário
      if (filterArea && t.area !== filterArea) return;
      if (onlyMine && !isMineTask(t)) return; // "Minhas demandas"
      const taskColor = t.status === "in-progress" ? "#F59E0B" : t.status === "not-started" ? "#9CA3AF" : TASK_COLOR;
      const taskTeamId = getTeamIdFromAreaKey(t.area);
      const taskScope = taskTeamId
        ? teams.find(team => team.id.toLowerCase() === taskTeamId.toLowerCase())?.name || "Time"
        : AREAS.find(area => area.key === t.area)?.label || "Sem área";
      const taskResponsible = t.responsible?.map(person => person.name).filter(Boolean).join(", ") || "Sem responsável";
      items.push({
        id: t.id,
        title: t.title,
        type: "task",
        date: t.deadline,
        color: taskColor,
        status: t.status,
        isDemand: true,
        scopeLabel: taskScope,
        responsibleName: taskResponsible,
      });
    });
    // "Minhas demandas" foca só nas suas demandas — publicações e eventos ficam ocultos
    posts.forEach((p) => {
      if (onlyMine) return;
      if (!p.date) return; // estacionamento
      if (filterArea) return;
      items.push({ id: p.id, title: p.title, type: "post", date: p.date, time: p.time, color: POST_COLOR, status: p.status, scopeLabel: "Publicação" });
    });
    events.forEach((e) => {
      if (onlyMine) return;
      if (filterArea) return;
      const et = eventTypes.find(t => t.name === e.type);
      items.push({ id: e.id, title: e.title, type: "event", date: e.date, color: et?.color || EVENT_FALLBACK_COLOR, eventTypeName: e.type, scopeLabel: e.type || "Evento" });
    });
    // Detecta demandas copiadas entre pessoas (mesmo título + data + área).
    // Para essas, o calendário mostra "PrimeiroNome - Título" para diferenciá-las.
    const dupCount = new Map<string, number>();
    parkingItems.forEach((p) => {
      if (!p.date) return;
      const sig = `${p.area}|||${p.date}|||${p.title}`;
      dupCount.set(sig, (dupCount.get(sig) || 0) + 1);
    });
    parkingItems.forEach((p) => {
      if (!p.date) return;
      if (!showDone && p.status === "done") return; // "Mostrar concluídas" desligado
      if (onlyMine && !isMineParking(p.personId)) return; // "Minhas demandas"
      if (filterArea && !sameAreaOrTeam(p.area, filterArea)) return;
      const teamId = getTeamIdFromAreaKey(p.area);
      const isTeam = !!teamId;
      const areaMeta = AREAS.find(a => a.key === p.area);
      const teamObj = isTeam ? teams.find(t => t.id === teamId || t.id.toLowerCase() === teamId!.toLowerCase()) : null;
      const color = isTeam ? getTeamColor(teamObj?.id || teamId!) : (areaMeta?.color || "#CBD5E1");
      const label = isTeam ? (teamObj?.name || "Time") : (areaMeta?.label || "Sem área");
      const sig = `${p.area}|||${p.date}|||${p.title}`;
      const isDup = (dupCount.get(sig) || 0) > 1;
      const person = p.personId ? people.find(pe => pe.id === p.personId) : null;
      const firstName = person ? person.name.split(" ")[0] : null;
      const displayTitle = isDup && firstName ? `${firstName} - ${p.title}` : p.title;
      items.push({
        id: p.id,
        parkingId: p.id,
        title: displayTitle,
        type: "event",
        date: p.date,
        color,
        status: p.status,
        eventTypeName: label,
        scopeLabel: label,
        responsibleName: person?.name || "Sem responsável",
        isDemand: true,
      });
    });
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, posts, events, parkingItems, teams, people, filterArea, eventTypes, onlyMine, showDone, myPersonIds]);

  const handleDragStart = (e: DragEvent, item: CalendarItem) => {
    if (!isAdmin) { e.preventDefault(); return; }
    setDragItem(item); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", JSON.stringify(item));
    if (!isMobile && e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = "0.5";
  };
  const handleDragEnd = (e: DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = "1";
    setDragItem(null); setDropTarget(null);
  };
  const handleDragOver = (e: DragEvent, dayStr: string) => {
    if (!isAdmin) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget((cur) => (cur === dayStr ? cur : dayStr));
  };
  const handleDragLeave = () => setDropTarget((cur) => (cur === null ? cur : null));

  const handleParkingDragOver = (e: DragEvent) => {
    if (!isAdmin) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!dragItem || dragItem.type === "post" || dragItem.type === "task") {
      setParkingDropActive((cur) => (cur ? cur : true));
    }
  };
  const handleParkingDragLeave = () => setParkingDropActive((cur) => (cur ? false : cur));
  const handleParkingDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setParkingDropActive(false);
    if (!isAdmin) { setDragItem(null); return; }
    const droppedItem = dragItem ?? (() => {
      try { return JSON.parse(e.dataTransfer.getData("text/plain")) as CalendarItem; } catch { return null; }
    })();
    if (!droppedItem) return;
    if (droppedItem.parkingId) {
      // Dragging a parking item from calendar back to Papel — clear date & responsible
      const pk = parkingItems.find(p => p.id === droppedItem.parkingId);
      if (pk && (pk.date || pk.personId)) {
        updateParkingItem({ ...pk, date: "", personId: null });
        toast.success("Demanda devolvida ao Papel");
      }
      setDragItem(null);
      return;
    }
    if (droppedItem.type === "task") {
      const task = tasks.find(t => t.id === droppedItem.id);
      if (task) { updateTask({ ...task, deadline: "" }); toast.success("Demanda movida para Papel"); }
      setDragItem(null);
      return;
    }
    if (droppedItem.type === "event") {
      toast.error("Eventos não podem ser estacionados");
      setDragItem(null);
      return;
    }
    const post = posts.find(p => p.id === droppedItem.id);
    if (post) {
      updatePost({ ...post, date: "", time: "" });
      toast.success("Publicação estacionada");
    }
    setDragItem(null);
  };

  const handleDrop = (e: DragEvent, dayStr: string) => {
    e.preventDefault(); setDropTarget(null);
    if (!isAdmin) { toast.error("Apenas diretores podem alterar datas"); setDragItem(null); return; }
    const droppedItem = dragItem ?? (() => {
      try { return JSON.parse(e.dataTransfer.getData("text/plain")) as CalendarItem; } catch { return null; }
    })();
    if (!droppedItem) return;
    if (droppedItem.parkingId) { dropParkingOnDate(droppedItem.parkingId, dayStr); setDragItem(null); return; }
    if (droppedItem.type === "task") { const task = tasks.find(t => t.id === droppedItem.id); if (task) updateTask({ ...task, deadline: dayStr }); }
    else if (droppedItem.type === "post") { const post = posts.find(p => p.id === droppedItem.id); if (post) updatePost({ ...post, date: dayStr }); }
    else if (droppedItem.type === "event") { const ev = events.find(e => e.id === droppedItem.id); if (ev) updateEvent({ ...ev, date: dayStr }); }
    setDragItem(null);
  };

  const handleItemClick = (item: CalendarItem) => {
    if (item.parkingId) {
      const pk = parkingItems.find(p => p.id === item.parkingId);
      if (pk) setIdeaModal({ open: true, item: pk });
      return;
    }
    if (item.type === "task") setTaskModal({ open: true, task: tasks.find(t => t.id === item.id) });
    else if (item.type === "post") setPostModal({ open: true, post: posts.find(p => p.id === item.id) });
    else if (item.type === "event") setEventModal({ open: true, event: events.find(e => e.id === item.id) });
  };

  const navigatePrev = () => setCurrentDate(subMonths(currentDate, 1));
  const navigateNext = () => setCurrentDate(addMonths(currentDate, 1));
  const headerLabel = () => format(currentDate, "MMMM yyyy", { locale: ptBR });

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const monthDays = eachDayOfInterval({ start: calStart, end: calEnd });

  const mobileWeekEndStr = format(addDays(getNowBrasilia(), 7), "yyyy-MM-dd");
  const mobileUpcomingDays = useMemo(() => {
    const grouped = new Map<string, CalendarItem[]>();

    allItems.forEach(item => {
      if (!item.date || item.date < calendarTodayStr || item.date > mobileWeekEndStr) return;
      const current = grouped.get(item.date) || [];
      current.push(item);
      grouped.set(item.date, current);
    });

    return [...grouped.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([dateStr, items]) => ({
        dateStr,
        date: new Date(`${dateStr}T00:00:00`),
        items: sortCalendarItems(items, calendarTodayStr),
      }));
  }, [allItems, calendarTodayStr, mobileWeekEndStr]);
  const mobileLaterDays = useMemo(() => {
    const grouped = new Map<string, CalendarItem[]>();

    allItems.forEach(item => {
      if (!item.date || item.date <= mobileWeekEndStr) return;
      const current = grouped.get(item.date) || [];
      current.push(item);
      grouped.set(item.date, current);
    });

    return [...grouped.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([dateStr, items]) => ({
        dateStr,
        date: new Date(`${dateStr}T00:00:00`),
        items: sortCalendarItems(items, calendarTodayStr),
      }));
  }, [allItems, calendarTodayStr, mobileWeekEndStr]);
  const mobileVisibleDays = showAllUpcoming
    ? [...mobileUpcomingDays, ...mobileLaterDays]
    : mobileUpcomingDays;
  const mobileUpcomingTotal = mobileUpcomingDays.reduce((total, day) => total + day.items.length, 0);
  const mobileLaterTotal = mobileLaterDays.reduce((total, day) => total + day.items.length, 0);
  const mobileFilterCount = Number(onlyMine) + Number(!showDone) + Number(!!filterArea);

  // Dynamic cell height: compact when few demands, grows with content
  const maxItemsInDay = useMemo(() => {
    let max = 0;
    monthDays.forEach(day => {
      const dayStr = format(day, "yyyy-MM-dd");
      const count = allItems.filter(item => item.date === dayStr).length;
      if (count > max) max = count;
    });
    return max;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allItems, currentDate]);
  // 36px header + 18px per row of 2 pills (max 10 pills = 5 rows), min 48px
  const desktopCellHeight = isMobile ? undefined : Math.max(48, 36 + Math.ceil(Math.min(maxItemsInDay, 10) / 2) * 18);

  const typeLabels: Record<string, string> = { task: "Demanda", post: "Post", event: "Evento" };

  const renderItemPill = (item: CalendarItem) => {
    const demandVisual = getDemandCalendarVisual(item, calendarTodayStr);
    return (
      <div
        key={item.id}
        draggable={isAdmin}
        onDragStart={(e) => handleDragStart(e, item)}
        onDragEnd={handleDragEnd}
        onClick={(e) => { e.stopPropagation(); if (longPress.isActive()) return; handleItemClick(item); }}
        onPointerDown={(e) => longPress.handlers.onPointerDown(e, { payload: item, label: item.title, color: item.color })}
        onPointerMove={longPress.handlers.onPointerMove}
        onPointerUp={longPress.handlers.onPointerUp}
        onPointerCancel={longPress.handlers.onPointerCancel}
        onMouseEnter={(e) => {
          if (!isMobile) setTooltipState({ item, rect: (e.currentTarget as HTMLElement).getBoundingClientRect() });
        }}
        onMouseLeave={() => setTooltipState(null)}
        style={{
          touchAction: "pan-y",
          transition: "transform 380ms cubic-bezier(0.4,0,0.2,1), opacity 380ms ease, border-color 160ms ease, box-shadow 160ms ease",
          transform: shrinkingId === item.id ? "scale(0)" : undefined,
          opacity: shrinkingId === item.id ? 0 : demandVisual?.kind === "done" ? 0.58 : 1,
          transformOrigin: "bottom right",
          borderColor: demandVisual?.color || "transparent",
          boxShadow: demandVisual ? `0 0 0 1px ${demandVisual.color}88` : undefined,
        }}
        className={`demand-hover relative group/pill flex items-stretch border ${isMobile ? "rounded-lg" : "rounded-md"} overflow-hidden shadow-sm ${isAdmin ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
      >
        {item.type === "post" && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); if (isAdmin) cyclePostStatus(item.id); }}
            title={POST_STATUS_META[item.status || "not-started"]?.label}
            style={{ backgroundColor: POST_STATUS_META[item.status || "not-started"]?.color || "#9CA3AF" }}
            className={`w-1 shrink-0 ${isAdmin ? "cursor-pointer hover:w-1.5 transition-all" : ""}`}
          />
        )}
        {demandVisual && (
          <span
            title={demandVisual.label}
            className="absolute left-0.5 top-0.5 z-10 h-3.5 w-3.5 rounded-full bg-white/95 flex items-center justify-center shadow-sm"
          >
            {demandVisual.kind === "overdue" ? (
              <AlertTriangle className="h-2.5 w-2.5 text-red-500" />
            ) : (
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: demandVisual.color }} />
            )}
          </span>
        )}
        <div
          style={{ backgroundColor: item.color }}
          className={`flex-1 min-w-0 text-white font-medium hover:opacity-80 transition-opacity pointer-events-none ${
            isMobile
              ? `text-[10px] leading-snug py-1 rounded-md whitespace-normal break-words line-clamp-2 ${demandVisual ? "pl-5 pr-1.5" : "px-1.5"}`
              : `text-[9px] sm:text-[10px] leading-tight py-0.5 whitespace-normal break-words line-clamp-2 pr-4 ${demandVisual ? "pl-5" : "px-1 sm:px-1.5"}`
          }`}
        >
          {item.title}
        </div>
        {!isMobile && (
          <button onClick={(e) => { e.stopPropagation(); setDeleting({ open: true, id: item.id, title: item.title, type: item.type, parkingId: item.parkingId }); }}
            className="absolute top-0 right-0 h-full px-0.5 flex items-center opacity-0 group-hover/pill:opacity-100 transition-opacity">
            <X className="h-2.5 w-2.5 text-white hover:text-destructive" />
          </button>
        )}
      </div>
    );
  };

  const renderDayCell = (day: Date, inMonth: boolean) => {
    const dayStr = format(day, "yyyy-MM-dd");
    const dayItems = sortCalendarItems(allItems.filter((item) => item.date === dayStr), calendarTodayStr);
    const todayFlag = isToday(day);
    const isDropping = dropTarget === dayStr;
    if (isMobile) {
      const statusColors = dayItems.slice(0, 4).map(item => getDemandCalendarVisual(item, calendarTodayStr)?.color || item.color);
      return (
        <div
          key={dayStr}
          data-drop-day={dayStr}
          onDragOver={(e) => handleDragOver(e, dayStr)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => isAdmin && handleDrop(e, dayStr)}
          onClick={() => { if (dayItems.length > 0) setDayPopup(dayStr); }}
          onKeyDown={(event) => {
            if (dayItems.length > 0 && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault();
              setDayPopup(dayStr);
            }
          }}
          role={dayItems.length > 0 ? "button" : undefined}
          tabIndex={dayItems.length > 0 ? 0 : undefined}
          className={`h-full min-h-[58px] border-b border-r border-border p-1.5 transition-colors flex flex-col ${!inMonth ? "bg-muted/30" : ""} ${todayFlag ? "bg-accent/50" : ""} ${isDropping ? "bg-primary/10 ring-2 ring-primary/30 ring-inset" : ""} ${dayItems.length > 0 ? "active:bg-accent/60 cursor-pointer" : ""}`}
          aria-label={dayItems.length > 0 ? `${format(day, "d 'de' MMMM", { locale: ptBR })}: ${dayItems.length} itens` : undefined}
        >
          <div className="flex items-center justify-between gap-1">
            <span className={`text-[11px] font-semibold ${todayFlag ? "bg-primary text-primary-foreground h-5 w-5 rounded-full flex items-center justify-center" : inMonth ? "text-foreground" : "text-muted-foreground/50"}`}>
              {format(day, "d")}
            </span>
            {dayItems.length > 0 && (
              <span className="min-w-5 rounded-full bg-primary/10 px-1.5 py-0.5 text-center text-[9px] font-bold text-primary">
                {dayItems.length}
              </span>
            )}
          </div>
          {statusColors.length > 0 && (
            <div className="mt-auto flex flex-wrap gap-1 pt-1.5" aria-hidden="true">
              {statusColors.map((color, index) => (
                <span key={`${dayStr}-${index}`} className="h-1.5 flex-1 min-w-1.5 rounded-full" style={{ backgroundColor: color }} />
              ))}
            </div>
          )}
        </div>
      );
    }
    // Desktop: máx 10 (5 linhas × 2 colunas — excesso no popup)
    const maxVisible = 10;
    const visibleItems = dayItems.slice(0, maxVisible);
    const hiddenCount = dayItems.length - visibleItems.length;
    return (
      <div
        key={dayStr}
        data-drop-day={dayStr}
        onDragOver={(e) => handleDragOver(e, dayStr)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => isAdmin && handleDrop(e, dayStr)}
        onClick={() => { if (isMobile && dayItems.length > 0) setDayPopup(dayStr); }}
        className={`h-full min-h-[64px] sm:min-h-0 border-b border-r border-border p-1 sm:p-1.5 transition-colors flex flex-col ${!inMonth ? "bg-muted/30" : ""} ${todayFlag ? "bg-accent/50" : ""} ${isDropping ? "bg-primary/10 ring-2 ring-primary/30 ring-inset" : ""} ${isMobile && dayItems.length > 0 ? "active:bg-accent/60 cursor-pointer" : ""}`}
      >
        <div className="flex items-center justify-between mb-1">
          <div className={`text-xs font-medium ${todayFlag ? "bg-primary text-primary-foreground h-5 w-5 rounded-full flex items-center justify-center" : inMonth ? "text-foreground" : "text-muted-foreground/50"}`}>
            {format(day, "d")}
          </div>
          {isAdmin && (
            <button
              onClick={(e) => { e.stopPropagation(); setEventModal({ open: true, date: dayStr }); }}
              className="h-4 w-4 rounded hover:bg-accent flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground"
              title="Novo evento"
            >
              <Plus className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className={`${isMobile ? "flex flex-col overflow-y-auto scrollbar-thin" : "grid grid-cols-2"} gap-0.5 min-h-0`}>{visibleItems.map((item) => renderItemPill(item))}</div>
        {hiddenCount > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); setDayPopup(dayStr); }}
            className="mt-0.5 w-full text-center text-[10px] font-bold text-primary bg-primary/10 rounded-md py-0.5"
          >
            +{hiddenCount}
          </button>
        )}
      </div>
    );
  };

  const formatDayHeader = (d: Date) => {
    const today = getNowBrasilia();
    if (isSameDay(d, today)) return "Hoje";
    if (isTomorrow(d)) return "Amanhã";
    return format(d, "EEE, d 'de' MMM", { locale: ptBR });
  };

  const renderListItem = (item: CalendarItem) => {
    const demandVisual = getDemandCalendarVisual(item, calendarTodayStr);
    const detailLabel = item.scopeLabel || item.eventTypeName || typeLabels[item.type];
    const statusLabel = demandVisual?.label || (item.type === "post" && item.status ? POST_STATUS_META[item.status]?.label : null);
    return (
      <button
        key={item.id}
        onClick={() => handleItemClick(item)}
        style={{ borderColor: demandVisual?.color || "transparent" }}
        className="demand-hover flex w-full items-start gap-2 rounded-xl border bg-background/70 px-3 py-2.5 text-left transition-colors hover:bg-accent"
      >
        {demandVisual?.kind === "overdue" ? (
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
        ) : demandVisual ? (
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: demandVisual.color }} />
        ) : (
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
        )}
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold leading-snug text-foreground break-words">{item.title}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-muted-foreground">
            <span>{detailLabel}</span>
            {item.responsibleName && <span>• {item.responsibleName}</span>}
            {statusLabel && <span style={{ color: demandVisual?.color }}>• {statusLabel}</span>}
          </span>
        </span>
        {item.time && <span className="shrink-0 text-[10px] font-semibold text-muted-foreground tabular-nums">{item.time}</span>}
      </button>
    );
  };

  return (
    <div className="animate-fade-in flex flex-col gap-3">
      {!isMobile && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <h1 className="text-xl font-bold tracking-tight text-foreground">Calendário</h1>
          <div className="flex flex-wrap items-center gap-2">
            <CalToggle active={onlyMine} onClick={() => setOnlyMine(value => !value)} icon={User} label="Minhas demandas" />
            <CalToggle active={showDone} onClick={() => setShowDone(value => !value)} icon={CheckCircle2} label="Mostrar concluídas" activeColor="#10B981" />
            <div className="flex min-w-[210px] items-center gap-1 rounded-xl border border-border bg-background p-0.5">
              <button onClick={navigatePrev} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent" aria-label="Mês anterior"><ChevronLeft className="h-4 w-4" /></button>
              <span className="min-w-0 flex-1 text-center text-sm font-semibold capitalize text-foreground">{headerLabel()}</span>
              <button onClick={navigateNext} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent" aria-label="Próximo mês"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop: dois retângulos acima do calendário */}
      {!isMobile && (
        <div className="flex gap-3 shrink-0">

          {/* Retângulo de filtros */}
          <div className="glass-panel rounded-2xl p-3 shrink-0">
            <div className="flex flex-col gap-2.5">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Áreas</span>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {AREAS.map(a => {
                    const active = filterArea === a.key;
                    return (
                      <button key={a.key} onClick={() => setFilterArea(active ? null : a.key)}
                        style={active ? { backgroundColor: a.color, borderColor: a.color, color: "#fff" } : undefined}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${active ? "" : "bg-background text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"}`}>
                        {a.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {teams.length > 0 && (
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Times</span>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {teams.map(t => {
                      const teamKey = `team_${t.id}`;
                      const active = filterArea === teamKey;
                      const teamColor = getTeamColor(t.id);
                      return (
                        <button key={teamKey} onClick={() => setFilterArea(active ? null : teamKey)}
                          style={active ? { backgroundColor: teamColor, borderColor: teamColor, color: "#fff" } : { borderColor: `${teamColor}40`, color: teamColor }}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${active ? "" : "bg-background hover:bg-accent"}`}>
                          {t.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {filterArea && activeAreaMeta && (
                <button onClick={() => setFilterArea(null)} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 w-fit">
                  <X className="h-3 w-3" /> Limpar filtro
                </button>
              )}
            </div>
          </div>

          {/* Retângulo do Papel — matriz 5 linhas × 8 colunas, colunas primeiro */}
          <div
            data-drop-parking="1"
            onDragOver={handleParkingDragOver}
            onDragLeave={handleParkingDragLeave}
            onDrop={handleParkingDrop}
            className={`cal-grid glass-panel rounded-2xl flex-1 p-3 transition-colors ${
              parkingDropActive ? "border-primary ring-2 ring-primary/30 bg-primary/5" : ""
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Papel</span>
              <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 font-medium">{parkedIdeas.length}</span>
              {isAdmin && (
                <form onSubmit={handleQuickIdea} className="ml-auto">
                  <input ref={newIdeaRef} value={newIdea} onChange={e => setNewIdea(e.target.value)}
                    placeholder={filterArea ? `Nova ideia em ${activeAreaMeta?.label}…` : "Nova ideia + Enter"}
                    className="bg-muted/50 rounded-md px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60 w-44" />
                </form>
              )}
            </div>
            {parkedIdeas.length === 0 ? (
              <span className="text-[11px] text-muted-foreground/60 italic">Nenhuma ideia estacionada</span>
            ) : (
              /* scroll-wrapper permite rolar horizontalmente sem criar contexto
                 de clipping vertical — pills escalados ficam sempre visíveis */
              <div className="overflow-x-auto scrollbar-thin" style={{ overflowY: "visible" }}>
                <div style={{ display: "grid", gridAutoFlow: "column", gridTemplateRows: "repeat(5, auto)", gap: "3px", width: "max-content" }}>
                  {parkedIdeas.slice(0, 40).map(p => {
                    const teamId = getTeamIdFromAreaKey(p.area);
                    const isTeam = !!teamId;
                    const areaMeta = AREAS.find(a => a.key === p.area);
                    const teamObj = isTeam ? teams.find(t => t.id === teamId || t.id.toLowerCase() === teamId!.toLowerCase()) : null;
                    const color = getAreaColor(p.area);
                    const label = isTeam ? (teamObj?.name || "Time") : (areaMeta?.label || "Sem área");
                    const dim = filterArea && p.area && !sameAreaOrTeam(p.area, filterArea);
                    return (
                      <div key={p.id} className={`shrink-0 ${dim ? "opacity-40" : ""}`} style={{ width: 118 }}>
                        {renderItemPill({ id: p.id, parkingId: p.id, title: p.title, type: "event", date: "", color, eventTypeName: label })}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Calendário full width — dias quadrados no desktop */}
      <div data-testid="mobile-calendar" className="glass-panel rounded-2xl cal-grid">
        {isMobile && (
          <>
            <div className="border-b border-border px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
                  <h1 className="text-sm font-bold text-foreground">Calendário</h1>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(open => !open)}
                  aria-expanded={mobileFiltersOpen}
                  aria-controls="mobile-calendar-filters"
                  className={`flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-colors ${mobileFiltersOpen || mobileFilterCount > 0 ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground"}`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>Filtros</span>
                  {mobileFilterCount > 0 && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                      {mobileFilterCount}
                    </span>
                  )}
                  {mobileFiltersOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
              </div>
              <div className="mt-2 flex items-center gap-1 rounded-xl border border-border bg-background/75 p-0.5">
                <button onClick={navigatePrev} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent" aria-label="Mês anterior"><ChevronLeft className="h-4 w-4" /></button>
                <span className="min-w-0 flex-1 text-center text-sm font-semibold capitalize text-foreground">{headerLabel()}</span>
                <button onClick={navigateNext} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent" aria-label="Próximo mês"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
            {mobileFiltersOpen && (
              <div id="mobile-calendar-filters" className="space-y-3 border-b border-border bg-muted/20 px-3 py-3">
                <div className="flex flex-wrap gap-2">
                  <CalToggle active={onlyMine} onClick={() => setOnlyMine(value => !value)} icon={User} label="Minhas demandas" />
                  <CalToggle active={showDone} onClick={() => setShowDone(value => !value)} icon={CheckCircle2} label="Mostrar concluídas" activeColor="#10B981" />
                </div>
                <div className="flex flex-wrap items-center gap-1.5 border-t border-border/70 pt-2.5">
                  <span className="w-full text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Áreas</span>
                  {AREAS.map(area => {
                    const active = filterArea === area.key;
                    return (
                      <button
                        key={area.key}
                        onClick={() => {
                          setFilterArea(active ? null : area.key);
                          setMobileFiltersOpen(false);
                          setShowAllUpcoming(false);
                        }}
                        style={active ? { backgroundColor: area.color, borderColor: area.color, color: "#fff" } : undefined}
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${active ? "" : "border-border bg-background text-muted-foreground"}`}
                      >
                        {area.label}
                      </button>
                    );
                  })}
                </div>
                {teams.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 border-t border-border/70 pt-2.5">
                    <span className="w-full text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Times</span>
                    {teams.map(team => {
                      const teamKey = `team_${team.id}`;
                      const active = filterArea === teamKey;
                      const teamColor = getTeamColor(team.id);
                      return (
                        <button
                          key={teamKey}
                          onClick={() => {
                            setFilterArea(active ? null : teamKey);
                            setMobileFiltersOpen(false);
                            setShowAllUpcoming(false);
                          }}
                          style={active ? { backgroundColor: teamColor, borderColor: teamColor, color: "#fff" } : { borderColor: `${teamColor}40`, color: teamColor }}
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${active ? "" : "bg-background"}`}
                        >
                          {team.name}
                        </button>
                      );
                    })}
                  </div>
                )}
                {mobileFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setOnlyMine(false);
                      setShowDone(true);
                      setFilterArea(null);
                      setMobileFiltersOpen(false);
                      setShowAllUpcoming(false);
                    }}
                    className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" /> Limpar filtros
                  </button>
                )}
              </div>
            )}
          </>
        )}
        <div className="grid grid-cols-7 border-b border-border">
          {weekDays.map(d => (
            <div key={d} className={`text-center font-medium text-muted-foreground uppercase tracking-wider ${isMobile ? "py-1.5 text-[10px]" : "py-2 text-xs"}`}>
              {isMobile ? d[0] : d}
            </div>
          ))}
        </div>
        <div
          className="grid grid-cols-7"
          style={isMobile ? { gridTemplateRows: `repeat(${monthDays.length / 7}, minmax(72px, auto))` } : undefined}
        >
          {monthDays.map((day) => (
            <div
              key={format(day, "yyyy-MM-dd")}
              className="group"
              style={!isMobile ? { minHeight: `${desktopCellHeight}px`, overflow: "visible" } : undefined}
            >
              {renderDayCell(day, isSameMonth(day, currentDate))}
            </div>
          ))}
        </div>
      </div>

      {/* Ideias (Papel) no mobile — demandas sem prazo, de qualquer área ou time */}
      {isMobile && parkedIdeas.length > 0 && (
        <section data-testid="mobile-ideas-list" className="glass-panel overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-3">
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-foreground">Papel</h2>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Demandas sem prazo definido</p>
            </div>
            <span className="shrink-0 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-700">
              {parkedIdeas.length}
            </span>
          </div>
          <ul className="divide-y divide-border">
            {parkedIdeas.slice(0, 20).map(p => {
              const person = p.personId ? people.find(pe => pe.id === p.personId) : null;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => isAdmin && setIdeaModal({ open: true, item: p })}
                    disabled={!isAdmin}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left disabled:cursor-default"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: getAreaColor(p.area) }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-foreground">{p.title}</span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {getAreaLabel(p.area) || (getTeamIdFromAreaKey(p.area) ? "Time" : "Sem área")}
                        {person ? ` · ${person.name.split(" ")[0]}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                      Sem data
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {isMobile && (
        <section data-testid="mobile-upcoming-list" className="glass-panel overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-border py-3 pl-14 pr-3">
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-foreground">
                {onlyMine ? "Minhas próximas demandas" : "Próximas demandas"}
              </h2>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Hoje até {format(new Date(`${mobileWeekEndStr}T00:00:00`), "d 'de' MMM", { locale: ptBR })}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
              {showAllUpcoming ? mobileUpcomingTotal + mobileLaterTotal : mobileUpcomingTotal}
            </span>
          </div>
          {mobileVisibleDays.length === 0 ? (
            <div className="px-3 py-7 text-center text-xs text-muted-foreground">Nenhuma demanda agendada a partir de hoje</div>
          ) : (
            <div className="divide-y divide-border">
              {mobileVisibleDays.map(({ date, dateStr, items }) => (
                <div key={dateStr} className="px-3 py-2.5">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-xs font-semibold capitalize text-foreground">{formatDayHeader(date)}</span>
                    <span className="text-[10px] text-muted-foreground">{items.length} {items.length === 1 ? "item" : "itens"}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    {items.map(item => renderListItem(item))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {mobileLaterTotal > 0 && (
            <button
              type="button"
              onClick={() => setShowAllUpcoming(value => !value)}
              aria-expanded={showAllUpcoming}
              className="flex w-full items-center justify-center gap-1.5 border-t border-border px-3 py-3 text-xs font-bold text-primary transition-colors hover:bg-primary/5"
            >
              {showAllUpcoming ? (
                <><ChevronUp className="h-4 w-4" /> Ver menos</>
              ) : (
                <><ChevronDown className="h-4 w-4" /> Ver mais ({mobileLaterTotal})</>
              )}
            </button>
          )}
        </section>
      )}

      {/* Popup com todas as demandas do dia */}
      <Dialog open={!!dayPopup} onOpenChange={(o) => { if (!o) setDayPopup(null); }}>
        <DialogContent className="max-w-sm max-h-[75vh] overflow-y-auto rounded-2xl">
          {(() => {
            const popupItems = dayPopup
              ? sortCalendarItems(allItems.filter(i => i.date === dayPopup), calendarTodayStr)
              : [];
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="capitalize text-base">
                    {dayPopup ? format(new Date(dayPopup + "T00:00:00"), "EEEE, d 'de' MMMM", { locale: ptBR }) : ""}
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground">
                    {popupItems.length} {popupItems.length === 1 ? "item agendado" : "itens agendados"}
                  </p>
                </DialogHeader>
                {popupItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nada agendado neste dia.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {popupItems.map(item => (
                      <button
                        key={item.id}
                        onClick={() => { setDayPopup(null); handleItemClick(item); }}
                        className="flex items-stretch gap-0 text-left rounded-xl border border-border/60 overflow-hidden hover:bg-accent active:scale-[0.99] transition-all"
                        style={{ backgroundColor: `${item.color}0A` }}
                      >
                        <span className="w-1.5 shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="flex-1 min-w-0 px-3 py-2.5">
                          <span className="block text-sm font-semibold text-foreground break-words leading-snug">{item.title}</span>
                          <span className="block text-[10px] font-medium mt-1" style={{ color: item.color }}>
                            {item.parkingId ? item.eventTypeName : typeLabels[item.type]}
                            {item.type === "post" && item.status ? ` • ${POST_STATUS_META[item.status]?.label || item.status}` : ""}
                            {item.type === "event" && !item.parkingId && item.eventTypeName ? ` • ${item.eventTypeName}` : ""}
                          </span>
                        </span>
                        {item.time && (
                          <span className="self-center text-[11px] font-semibold text-muted-foreground tabular-nums shrink-0 pr-3">{item.time}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <TaskModal open={taskModal.open} onOpenChange={o => setTaskModal({ open: o })} task={taskModal.task} defaultDate={taskModal.date} />
      <PostModal open={postModal.open} onOpenChange={o => setPostModal({ open: o })} post={postModal.post} defaultDate={postModal.date} />
      <EventModal open={eventModal.open} onOpenChange={o => setEventModal({ open: o })} event={eventModal.event} defaultDate={eventModal.date} />
      <IdeaModal
        open={ideaModal.open}
        onOpenChange={(o) => setIdeaModal(s => ({ ...s, open: o }))}
        item={ideaModal.item}
        defaultDate={ideaModal.defaultDate}
        defaultArea={ideaModal.defaultArea}
        requireFull={ideaModal.requireFull}
      />
      <DeleteConfirmDialog open={deleting.open} onOpenChange={o => setDeleting(p => ({ ...p, open: o }))}
        title={deleting.title} onConfirm={handleDelete} />

      {tooltipState && createPortal(
        <div
          style={{
            position: "fixed",
            bottom: window.innerHeight - tooltipState.rect.top + 8,
            left: tooltipState.rect.left + tooltipState.rect.width / 2,
            transform: "translateX(-50%)",
            zIndex: 99999,
            pointerEvents: "none",
          }}
          className="bg-popover text-popover-foreground border border-border rounded-lg shadow-lg px-3 py-2 text-xs max-w-[220px]"
        >
          <p className="font-semibold leading-snug">{tooltipState.item.title}</p>
          <p className="text-muted-foreground mt-0.5">
            {typeLabels[tooltipState.item.type]} • {tooltipState.item.date}
            {tooltipState.item.time ? ` ${tooltipState.item.time}` : ""}
          </p>
          {tooltipState.item.status && (
            <p className="text-muted-foreground">
              Status: {tooltipState.item.type === "post"
                ? POST_STATUS_META[tooltipState.item.status]?.label || tooltipState.item.status
                : tooltipState.item.status}
            </p>
          )}
        </div>,
        document.body
      )}

      {isAdmin && !isMobile && (
        <>
          <style>{`
            @keyframes trashShake {
              0%, 100% { transform: rotate(0deg) scale(1.15); }
              20% { transform: rotate(-12deg) scale(1.15); }
              40% { transform: rotate(10deg) scale(1.15); }
              60% { transform: rotate(-8deg) scale(1.15); }
              80% { transform: rotate(6deg) scale(1.15); }
            }
            @keyframes trashFloat {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-4px); }
            }
          `}</style>
          <div
            onDragOver={handleTrashDragOver}
            onDragLeave={handleTrashDragLeave}
            onDrop={handleTrashDrop}
            className={`fixed bottom-6 right-6 z-50 w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
              trashActive
                ? "bg-destructive/20 ring-4 ring-destructive/40 shadow-2xl"
                : dragItem
                ? "bg-background/80 ring-2 ring-border shadow-xl"
                : "bg-background/60 ring-1 ring-border/60 shadow-lg hover:shadow-xl"
            }`}
            style={{ backdropFilter: "blur(4px)" }}
            title="Arraste aqui para excluir"
          >
            <img
              src={trashBinImg}
              alt="Lixeira"
              draggable={false}
              className="w-full h-full object-contain pointer-events-none select-none"
              style={{
                animation: trashActive
                  ? "trashShake 1.1s ease-in-out infinite"
                  : "trashFloat 6s ease-in-out infinite",
                transformOrigin: "center bottom",
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
