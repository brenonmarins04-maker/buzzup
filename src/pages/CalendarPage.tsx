import { useState, useMemo, useRef, useEffect, type DragEvent } from "react";
import { ChevronLeft, ChevronRight, Plus, X, ChevronUp, ChevronDown, CalendarDays } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import type { Task, Post, CalendarEvent } from "@/contexts/DataContext";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth,
  addMonths, subMonths, isToday, isSameDay,
  startOfWeek, endOfWeek, addDays, subDays, isTomorrow,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import TaskModal from "@/components/modals/TaskModal";
import PostModal from "@/components/modals/PostModal";
import EventModal from "@/components/modals/EventModal";
import IdeaModal from "@/components/modals/IdeaModal";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { getNowBrasilia } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLongPressDrag, type DragDropResult } from "@/hooks/useLongPressDrag";
import { AREAS, getTeamColor, getAreaColor } from "@/lib/areas";
import { isLeaderOfAny } from "@/lib/leadership";
import trashBinImg from "@/assets/trash-bin.png";

export type CalendarItem = {
  id: string; title: string; type: "task" | "post" | "event";
  date: string; time?: string; color: string; status?: string;
  eventTypeName?: string;
  /** Subtype for "event"-rendered parking items so drop logic can detect them. */
  parkingId?: string;
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
const nextPostStatus = (s?: string) => {
  const i = POST_STATUS_ORDER.indexOf((s as any) ?? "not-started");
  return POST_STATUS_ORDER[(i + 1) % POST_STATUS_ORDER.length];
};

export default function CalendarPage() {
  const { tasks, posts, events, eventTypes, parkingItems, teams, people, updateTask, updatePost, updateEvent, deleteTask, deletePost, deleteEvent, addParkingItem, updateParkingItem, deleteParkingItem } = useData();
  const { isAdmin: _isAdmin, user } = useAuth();
  // No calendário, líderes de qualquer área/time podem editar (mover, criar, status).
  // Sombreamos isAdmin para que todas as checagens existentes incluam líderes.
  const isAdmin = _isAdmin || isLeaderOfAny(people, user?.id);
  const isMobile = useIsMobile();
  const [currentDate, setCurrentDate] = useState(getNowBrasilia());
  const [filterArea, setFilterArea] = useState<string | null>(null);
  const [newIdea, setNewIdea] = useState("");
  const [parkingDropActive, setParkingDropActive] = useState(false);
  const newIdeaRef = useRef<HTMLInputElement>(null);
  const [showPast, setShowPast] = useState(false);
  const upcomingTopRef = useRef<HTMLDivElement>(null);

  const [taskModal, setTaskModal] = useState<{ open: boolean; task?: Task | null; date?: string }>({ open: false });
  const [postModal, setPostModal] = useState<{ open: boolean; post?: Post | null; date?: string }>({ open: false });
  const [eventModal, setEventModal] = useState<{ open: boolean; event?: CalendarEvent | null; date?: string }>({ open: false });
  const [ideaModal, setIdeaModal] = useState<{ open: boolean; item: import("@/contexts/DataContext").ParkingItem | null; defaultDate?: string; defaultArea?: string; requireFull?: boolean }>({ open: false, item: null });
  const [deleting, setDeleting] = useState<{ open: boolean; id: string; title: string; type: string }>({ open: false, id: "", title: "", type: "" });

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
    ? (filterArea.startsWith("team_")
      ? { key: filterArea, label: teams.find(t => `team_${t.id}` === filterArea)?.name || "Time", color: getTeamColor(filterArea.slice(5)) }
      : AREAS.find(a => a.key === filterArea))
    : null;
  // All ideas without a date — always shown in sidebar regardless of area filter.
  const parkedIdeas = useMemo(() => {
    const ideas = parkingItems.filter(p => !p.date);
    // When a filter is active, sort: matching area/team first, others below
    if (filterArea) {
      const matching = ideas.filter(p => p.area === filterArea);
      const others = ideas.filter(p => p.area !== filterArea);
      return [...matching, ...others];
    }
    return ideas;
  }, [parkingItems, filterArea]);

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
    if (deleting.type === "task") deleteTask(deleting.id);
    else if (deleting.type === "post") deletePost(deleting.id);
    else if (deleting.type === "event") deleteEvent(deleting.id);
    toast.success("Item excluído");
  };

  const allItems = useMemo<CalendarItem[]>(() => {
    const items: CalendarItem[] = [];
    tasks.forEach((t) => {
      if (t.status === "done") return; // demandas concluídas não aparecem no calendário
      if (filterArea && t.area !== filterArea) return;
      const taskColor = t.status === "in-progress" ? "#F59E0B" : t.status === "not-started" ? "#9CA3AF" : TASK_COLOR;
      items.push({ id: t.id, title: t.title, type: "task", date: t.deadline, color: taskColor, status: t.status });
    });
    posts.forEach((p) => {
      if (!p.date) return; // estacionamento
      if (filterArea) return;
      items.push({ id: p.id, title: p.title, type: "post", date: p.date, time: p.time, color: POST_COLOR, status: p.status });
    });
    events.forEach((e) => {
      if (filterArea) return;
      const et = eventTypes.find(t => t.name === e.type);
      items.push({ id: e.id, title: e.title, type: "event", date: e.date, color: et?.color || EVENT_FALLBACK_COLOR, eventTypeName: e.type });
    });
    // Detecta demandas copiadas entre pessoas (mesmo título + data + área).
    // Para essas, o calendário mostra "PrimeiroNome - Título" para diferenciá-las.
    const dupCount = new Map<string, number>();
    parkingItems.forEach((p) => {
      if (!p.date || p.status === "done") return;
      const sig = `${p.area}|||${p.date}|||${p.title}`;
      dupCount.set(sig, (dupCount.get(sig) || 0) + 1);
    });
    parkingItems.forEach((p) => {
      if (!p.date) return;
      if (p.status === "done") return;
      if (filterArea && p.area !== filterArea) return;
      const isTeam = p.area.startsWith("team_");
      const areaMeta = AREAS.find(a => a.key === p.area);
      const teamObj = isTeam ? teams.find(t => `team_${t.id}` === p.area) : null;
      const color = isTeam ? getTeamColor(p.area.slice(5)) : (areaMeta?.color || "#CBD5E1");
      const label = isTeam ? (teamObj?.name || "Time") : (areaMeta?.label || "Sem área");
      const sig = `${p.area}|||${p.date}|||${p.title}`;
      const isDup = (dupCount.get(sig) || 0) > 1;
      const person = p.personId ? people.find(pe => pe.id === p.personId) : null;
      const firstName = person ? person.name.split(" ")[0] : null;
      const displayTitle = isDup && firstName ? `${firstName} - ${p.title}` : p.title;
      items.push({ id: p.id, parkingId: p.id, title: displayTitle, type: "event", date: p.date, color, eventTypeName: label });
    });
    return items;
  }, [tasks, posts, events, parkingItems, teams, people, filterArea, eventTypes]);

  const upcomingPendingPosts = useMemo(() => {
    const today = getNowBrasilia();
    const todayStr = format(today, "yyyy-MM-dd");
    return posts.filter(p => {
      if (!p.date) return false;
      if (p.status === "published") return false;
      return p.date >= todayStr;
    });
  }, [posts]);

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
  const hours = Array.from({ length: 14 }, (_, i) => i + 7);
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const monthDays = eachDayOfInterval({ start: calStart, end: calEnd });

  const typeLabels: Record<string, string> = { task: "Demanda", post: "Post", event: "Evento" };

  const renderItemPill = (item: CalendarItem) => (
    <Tooltip key={item.id}>
      <TooltipTrigger asChild>
        <div
          draggable={isAdmin}
          onDragStart={(e) => handleDragStart(e, item)}
          onDragEnd={handleDragEnd}
          onClick={(e) => { e.stopPropagation(); if (longPress.isActive()) return; handleItemClick(item); }}
          onPointerDown={(e) => longPress.handlers.onPointerDown(e, { payload: item, label: item.title, color: item.color })}
          onPointerMove={longPress.handlers.onPointerMove}
          onPointerUp={longPress.handlers.onPointerUp}
          onPointerCancel={longPress.handlers.onPointerCancel}
          style={{
            touchAction: "pan-y",
            transition: "transform 380ms cubic-bezier(0.4,0,0.2,1), opacity 380ms ease",
            transform: shrinkingId === item.id ? "scale(0)" : undefined,
            opacity: shrinkingId === item.id ? 0 : 1,
            transformOrigin: "bottom right",
          }}
          className={`demand-hover relative group/pill flex items-stretch ${isMobile ? "rounded-lg" : "rounded-md"} overflow-hidden shadow-sm ${isAdmin ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
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
          <div
            style={{ backgroundColor: item.color }}
            className={`flex-1 min-w-0 text-white font-medium hover:opacity-80 transition-opacity pointer-events-none ${
              isMobile
                ? "text-[10px] leading-snug px-1.5 py-1 rounded-md whitespace-normal break-words line-clamp-2"
                : "text-[9px] sm:text-[10px] leading-tight px-1 sm:px-1.5 py-0.5 whitespace-normal break-words line-clamp-2 pr-4"
            }`}
          >
            {item.title}
          </div>
          <button onClick={(e) => { e.stopPropagation(); setDeleting({ open: true, id: item.id, title: item.title, type: item.type }); }}
            className="absolute top-0 right-0 h-full px-0.5 flex items-center opacity-0 group-hover/pill:opacity-100 transition-opacity">
            <X className="h-2.5 w-2.5 text-white hover:text-destructive" />
          </button>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} avoidCollisions className="text-xs max-w-[200px] z-[9999]">
        <p className="font-semibold">{item.title}</p>
        <p className="text-muted-foreground">{typeLabels[item.type]} • {item.date}{item.time ? ` ${item.time}` : ""}</p>
        {item.status && <p className="text-muted-foreground">Status: {item.type === "post" ? POST_STATUS_META[item.status]?.label || item.status : item.status}</p>}
      </TooltipContent>
    </Tooltip>
  );

  const renderDayCell = (day: Date, inMonth: boolean) => {
    const dayStr = format(day, "yyyy-MM-dd");
    const dayItems = allItems.filter((item) => item.date === dayStr);
    const todayFlag = isToday(day);
    const isDropping = dropTarget === dayStr;
    // Mobile: mostra no máximo 3 demandas; o restante fica no popup do dia
    const visibleItems = isMobile ? dayItems.slice(0, 3) : dayItems;
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
        <div className={`${isMobile ? "flex flex-col" : "grid grid-cols-2"} gap-0.5 min-h-0 overflow-y-auto scrollbar-thin`}>{visibleItems.map((item) => renderItemPill(item))}</div>
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

  // Upcoming list (mobile-only): next 7 days starting today
  const upcomingDays = useMemo(() => {
    const today = getNowBrasilia();
    const days: { date: Date; dateStr: string; items: CalendarItem[] }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(today, i);
      const dateStr = format(d, "yyyy-MM-dd");
      const items = allItems
        .filter(it => it.date === dateStr)
        .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
      if (items.length > 0) days.push({ date: d, dateStr, items });
    }
    return days;
  }, [allItems]);

  // Past list (mobile-only): previous 14 days, most recent first
  const pastDays = useMemo(() => {
    const today = getNowBrasilia();
    const todayStr = format(today, "yyyy-MM-dd");
    const days: { date: Date; dateStr: string; items: CalendarItem[] }[] = [];
    for (let i = 1; i <= 14; i++) {
      const d = subDays(today, i);
      const dateStr = format(d, "yyyy-MM-dd");
      if (dateStr >= todayStr) continue;
      const items = allItems
        .filter(it => it.date === dateStr)
        .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
      if (items.length > 0) days.push({ date: d, dateStr, items });
    }
    return days; // already most-recent-first
  }, [allItems]);

  const formatDayHeader = (d: Date) => {
    const today = getNowBrasilia();
    if (isSameDay(d, today)) return "Hoje";
    if (isTomorrow(d)) return "Amanhã";
    return format(d, "EEE, d 'de' MMM", { locale: ptBR });
  };

  const renderListItem = (item: CalendarItem, dim = false) => (
    <button
      key={item.id}
      onClick={() => handleItemClick(item)}
      className={`demand-hover flex items-center gap-2 text-left rounded-xl px-2 py-1.5 hover:bg-accent transition-colors ${dim ? "opacity-60" : ""}`}
    >
      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
      <span className="flex-1 min-w-0 text-xs text-foreground truncate">{item.title}</span>
      {item.time && <span className="text-[10px] text-muted-foreground tabular-nums">{item.time}</span>}
      {item.type === "post" && item.status && (
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: POST_STATUS_META[item.status]?.color || "#9CA3AF" }} />
      )}
    </button>
  );

  return (
    <div className="animate-fade-in flex flex-col gap-3">
      {/* Hero (mesma identidade visual do Início) */}
      <div className="page-hero relative overflow-hidden rounded-2xl p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-white/72 border border-border/70 backdrop-blur-sm flex items-center justify-center shrink-0 shadow-sm">
              <CalendarDays className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">Calendário</h1>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                Organize demandas, publicações e eventos em um só lugar.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 bg-white/70 border border-border/70 rounded-2xl p-0.5 backdrop-blur-sm">
              <button onClick={navigatePrev} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"><ChevronLeft className="h-4 w-4" /></button>
              <span className="text-sm font-semibold text-foreground min-w-[140px] sm:min-w-[180px] text-center capitalize">{headerLabel()}</span>
              <button onClick={navigateNext} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
      </div>

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
            className={`glass-panel rounded-2xl flex-1 p-3 transition-colors overflow-hidden ${
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
              <div
                className="overflow-x-auto scrollbar-thin"
                style={{ display: "grid", gridAutoFlow: "column", gridTemplateRows: "repeat(5, auto)", gap: "3px" }}
              >
                {parkedIdeas.slice(0, 40).map(p => {
                  const isTeam = p.area?.startsWith("team_");
                  const areaMeta = AREAS.find(a => a.key === p.area);
                  const teamObj = isTeam ? teams.find(t => `team_${t.id}` === p.area) : null;
                  const color = getAreaColor(p.area);
                  const label = isTeam ? (teamObj?.name || "Time") : (areaMeta?.label || "Sem área");
                  const dim = filterArea && p.area && p.area !== filterArea;
                  return (
                    <div key={p.id} className={`shrink-0 ${dim ? "opacity-40" : ""}`} style={{ width: 118 }}>
                      {renderItemPill({ id: p.id, parkingId: p.id, title: p.title, type: "event", date: "", color, eventTypeName: label })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filtros — mobile: pills horizontais */}
      {isMobile && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Áreas:</span>
          {AREAS.map(a => {
            const active = filterArea === a.key;
            return (
              <button key={a.key} onClick={() => setFilterArea(active ? null : a.key)}
                style={active ? { backgroundColor: a.color, borderColor: a.color, color: "#fff" } : undefined}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${active ? "" : "bg-background text-muted-foreground border-border"}`}>
                {a.label}
              </button>
            );
          })}
          {teams.map(t => {
            const teamKey = `team_${t.id}`;
            const active = filterArea === teamKey;
            const teamColor = getTeamColor(t.id);
            return (
              <button key={teamKey} onClick={() => setFilterArea(active ? null : teamKey)}
                style={active ? { backgroundColor: teamColor, borderColor: teamColor, color: "#fff" } : { borderColor: `${teamColor}40`, color: teamColor }}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${active ? "" : "bg-background"}`}>
                {t.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Calendário full width — dias quadrados no desktop */}
      <div className="glass-panel rounded-2xl overflow-hidden">
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
              style={!isMobile ? { aspectRatio: "1" } : undefined}
            >
              {renderDayCell(day, isSameMonth(day, currentDate))}
            </div>
          ))}
        </div>
      </div>

      {isMobile && (
        <div className="glass-panel rounded-2xl overflow-hidden">
          {/* Past toggle / list */}
          <button
            onClick={() => {
              setShowPast(v => {
                const next = !v;
                if (next) {
                  // expand past upward; keep upcoming roughly in place by scrolling to it after layout
                  setTimeout(() => upcomingTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
                }
                return next;
              });
            }}
            className="w-full px-3 py-2 border-b border-border flex items-center justify-between gap-2 hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              {showPast ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
              <span className="text-[11px] font-medium text-muted-foreground truncate">
                {showPast ? "Ocultar publicações anteriores" : `Ver últimas publicações (${pastDays.reduce((a, d) => a + d.items.length, 0)})`}
              </span>
            </div>
            {!showPast && pastDays.length > 0 && (
              <span className="text-[10px] text-muted-foreground/70">role para cima</span>
            )}
          </button>

          {showPast && (
            <div className="divide-y divide-border bg-muted/20">
              {pastDays.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-muted-foreground">Nenhuma publicação anterior nos últimos 14 dias</div>
              ) : (
                pastDays.map(({ date, dateStr, items }) => (
                  <div key={dateStr} className="px-3 py-2.5">
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-xs font-semibold capitalize text-muted-foreground">{format(date, "EEE, d 'de' MMM", { locale: ptBR })}</span>
                      <span className="text-[10px] text-muted-foreground/70">{items.length} {items.length === 1 ? "item" : "itens"}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {items.map(item => renderListItem(item, true))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          <div ref={upcomingTopRef} className="px-3 py-2 border-b border-border bg-card scroll-mt-16">
            <div className="text-xs font-semibold uppercase tracking-wide text-foreground">Próximos dias</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">O que vem por aí nos próximos 7 dias</div>
          </div>
          {upcomingDays.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">Nada agendado para os próximos 7 dias</div>
          ) : (
            <div className="divide-y divide-border">
              {upcomingDays.map(({ date, dateStr, items }) => (
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
        </div>
      )}

      {/* Popup com todas as demandas do dia */}
      <Dialog open={!!dayPopup} onOpenChange={(o) => { if (!o) setDayPopup(null); }}>
        <DialogContent className="max-w-sm max-h-[75vh] overflow-y-auto rounded-2xl">
          {(() => {
            const popupItems = dayPopup
              ? allItems
                  .filter(i => i.date === dayPopup)
                  .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"))
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
