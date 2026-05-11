import { useState, useMemo, useRef, type DragEvent } from "react";
import { ChevronLeft, ChevronRight, Plus, X, PanelLeftClose, PanelLeftOpen, Inbox, ChevronUp, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import type { Task, Post, CalendarEvent } from "@/contexts/DataContext";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth,
  addMonths, subMonths, addWeeks, subWeeks, addDays, subDays,
  startOfWeek, endOfWeek, isToday, isSameDay, isTomorrow,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import TaskModal from "@/components/modals/TaskModal";
import PostModal from "@/components/modals/PostModal";
import EventModal from "@/components/modals/EventModal";
import QuickCreateMenu from "@/components/modals/QuickCreateMenu";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import FilterChips from "@/components/FilterChips";
import { getNowBrasilia } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLongPressDrag, type DragDropResult } from "@/hooks/useLongPressDrag";

export type CalendarItem = {
  id: string; title: string; type: "task" | "post" | "event";
  date: string; time?: string; color: string; status?: string;
  eventTypeName?: string;
};

type ViewMode = "month" | "week" | "day";

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
  const { tasks, posts, events, teams, eventTypes, updateTask, updatePost, updateEvent, deleteTask, deletePost, deleteEvent, addPost } = useData();
  const { isAdmin } = useAuth();
  const isMobile = useIsMobile();
  const [currentDate, setCurrentDate] = useState(getNowBrasilia());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [filterTeams, setFilterTeams] = useState<string[]>([]);
  const [parkingOpen, setParkingOpen] = useState(true);
  const [newIdea, setNewIdea] = useState("");
  const [parkingDropActive, setParkingDropActive] = useState(false);
  const newIdeaRef = useRef<HTMLInputElement>(null);
  const [showPast, setShowPast] = useState(false);
  const upcomingTopRef = useRef<HTMLDivElement>(null);

  const [taskModal, setTaskModal] = useState<{ open: boolean; task?: Task | null; date?: string }>({ open: false });
  const [postModal, setPostModal] = useState<{ open: boolean; post?: Post | null; date?: string }>({ open: false });
  const [eventModal, setEventModal] = useState<{ open: boolean; event?: CalendarEvent | null; date?: string }>({ open: false });
  const [deleting, setDeleting] = useState<{ open: boolean; id: string; title: string; type: string }>({ open: false, id: "", title: "", type: "" });

  const [dragItem, setDragItem] = useState<CalendarItem | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const parkedPosts = useMemo(() => posts.filter(p => !p.date), [posts]);

  const applyDrop = (item: CalendarItem, target: DragDropResult) => {
    if (!isAdmin) { toast.error("Apenas administradores podem alterar datas"); return; }
    if (target.kind === "none") return;
    if (target.kind === "parking") {
      if (item.type !== "post") { toast.error("Apenas publicações podem ser estacionadas"); return; }
      const post = posts.find(p => p.id === item.id);
      if (post) { updatePost({ ...post, date: "", time: "" }); toast.success("Publicação estacionada"); }
      return;
    }
    // day drop
    const dayStr = target.date;
    if (item.type === "task") { const task = tasks.find(t => t.id === item.id); if (task) updateTask({ ...task, deadline: dayStr }); }
    else if (item.type === "post") { const post = posts.find(p => p.id === item.id); if (post) updatePost({ ...post, date: dayStr }); }
    else if (item.type === "event") { const ev = events.find(e => e.id === item.id); if (ev) updateEvent({ ...ev, date: dayStr }); }
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
    addPost({
      title, copy: "", link: "", date: "", time: "",
      channel: "", category: "", status: "not-started",
      responsibleIds: [], media_url: "", teamId: null,
    });
    setNewIdea("");
    toast.success("Ideia estacionada");
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
    const teamMatch = (teamId: string | null) => {
      if (filterTeams.length === 0) return true;
      if (!teamId) return filterTeams.includes("__none");
      return filterTeams.includes(teamId);
    };
    tasks.forEach((t) => {
      if (filterTypes.length > 0 && !filterTypes.includes("task")) return;
      if (!teamMatch(t.teamId)) return;
      items.push({ id: t.id, title: t.title, type: "task", date: t.deadline, color: TASK_COLOR, status: t.status });
    });
    posts.forEach((p) => {
      if (!p.date) return; // estacionamento
      if (filterTypes.length > 0 && !filterTypes.includes("post")) return;
      if (!teamMatch(p.teamId)) return;
      items.push({ id: p.id, title: p.title, type: "post", date: p.date, time: p.time, color: POST_COLOR, status: p.status });
    });
    events.forEach((e) => {
      if (filterTypes.length > 0 && !filterTypes.includes("event") && !filterTypes.includes(`event:${e.type}`)) return;
      if (!teamMatch(e.teamId)) return;
      const et = eventTypes.find(t => t.name === e.type);
      items.push({ id: e.id, title: e.title, type: "event", date: e.date, color: et?.color || EVENT_FALLBACK_COLOR, eventTypeName: e.type });
    });
    return items;
  }, [tasks, posts, events, filterTypes, filterTeams, eventTypes]);

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
    if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = "0.5";
  };
  const handleDragEnd = (e: DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = "1";
    setDragItem(null); setDropTarget(null);
  };
  const handleDragOver = (e: DragEvent, dayStr: string) => { if (!isAdmin) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDropTarget(dayStr); };
  const handleDragLeave = () => setDropTarget(null);

  const handleParkingDragOver = (e: DragEvent) => {
    if (!isAdmin) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!dragItem || dragItem.type === "post") setParkingDropActive(true);
  };
  const handleParkingDragLeave = () => setParkingDropActive(false);
  const handleParkingDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setParkingDropActive(false);
    if (!isAdmin) { setDragItem(null); return; }
    const droppedItem = dragItem ?? (() => {
      try { return JSON.parse(e.dataTransfer.getData("text/plain")) as CalendarItem; } catch { return null; }
    })();
    if (!droppedItem) return;
    if (droppedItem.type !== "post") {
      toast.error("Apenas publicações podem ser estacionadas");
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
    if (!isAdmin) { toast.error("Apenas administradores podem alterar datas"); setDragItem(null); return; }
    const droppedItem = dragItem ?? (() => {
      try { return JSON.parse(e.dataTransfer.getData("text/plain")) as CalendarItem; } catch { return null; }
    })();
    if (!droppedItem) return;
    if (droppedItem.type === "task") { const task = tasks.find(t => t.id === droppedItem.id); if (task) updateTask({ ...task, deadline: dayStr }); }
    else if (droppedItem.type === "post") { const post = posts.find(p => p.id === droppedItem.id); if (post) updatePost({ ...post, date: dayStr }); }
    else if (droppedItem.type === "event") { const ev = events.find(e => e.id === droppedItem.id); if (ev) updateEvent({ ...ev, date: dayStr }); }
    setDragItem(null);
  };

  const handleItemClick = (item: CalendarItem) => {
    if (item.type === "task") setTaskModal({ open: true, task: tasks.find(t => t.id === item.id) });
    else if (item.type === "post") setPostModal({ open: true, post: posts.find(p => p.id === item.id) });
    else if (item.type === "event") setEventModal({ open: true, event: events.find(e => e.id === item.id) });
  };

  const navigatePrev = () => {
    if (viewMode === "month") setCurrentDate(subMonths(currentDate, 1));
    else if (viewMode === "week") setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subDays(currentDate, 1));
  };
  const navigateNext = () => {
    if (viewMode === "month") setCurrentDate(addMonths(currentDate, 1));
    else if (viewMode === "week") setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const headerLabel = () => {
    if (viewMode === "month") return format(currentDate, "MMMM yyyy", { locale: ptBR });
    if (viewMode === "week") {
      const ws = startOfWeek(currentDate, { weekStartsOn: 0 });
      const we = endOfWeek(currentDate, { weekStartsOn: 0 });
      return `${format(ws, "d MMM", { locale: ptBR })} — ${format(we, "d MMM yyyy", { locale: ptBR })}`;
    }
    return format(currentDate, "EEEE, d 'de' MMMM yyyy", { locale: ptBR });
  };

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const hours = Array.from({ length: 14 }, (_, i) => i + 7);
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const monthDays = eachDayOfInterval({ start: calStart, end: calEnd });
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekDaysList = eachDayOfInterval({ start: weekStart, end: endOfWeek(currentDate, { weekStartsOn: 0 }) });

  const typeLabels: Record<string, string> = { task: "Tarefa", post: "Post", event: "Evento" };

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
          style={{ touchAction: "pan-y" }}
          className={`relative group/pill flex items-stretch rounded-sm overflow-hidden ${isAdmin ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
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
            className="flex-1 min-w-0 text-[9px] sm:text-[10px] leading-tight px-1 sm:px-1.5 py-0.5 text-white font-medium hover:opacity-80 transition-opacity pr-4 pointer-events-none truncate whitespace-nowrap"
          >
            {item.title}
          </div>
          <button onClick={(e) => { e.stopPropagation(); setDeleting({ open: true, id: item.id, title: item.title, type: item.type }); }}
            className="absolute top-0 right-0 h-full px-0.5 flex items-center opacity-0 group-hover/pill:opacity-100 transition-opacity">
            <X className="h-2.5 w-2.5 text-white hover:text-destructive" />
          </button>
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs max-w-[200px]">
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
    return (
      <div
        key={dayStr}
        data-drop-day={dayStr}
        onDragOver={(e) => handleDragOver(e, dayStr)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => isAdmin && handleDrop(e, dayStr)}
        className={`h-full min-h-[64px] sm:min-h-0 border-b border-r border-border p-1 sm:p-1.5 transition-colors flex flex-col ${!inMonth ? "bg-muted/30" : ""} ${todayFlag ? "bg-accent/50" : ""} ${isDropping ? "bg-primary/10 ring-2 ring-primary/30 ring-inset" : ""}`}
      >
        <div className="flex items-center justify-between mb-1">
          <div className={`text-xs font-medium ${todayFlag ? "bg-primary text-primary-foreground h-5 w-5 rounded-full flex items-center justify-center" : inMonth ? "text-foreground" : "text-muted-foreground/50"}`}>
            {format(day, "d")}
          </div>
          {isAdmin && (
            <QuickCreateMenu onCreateTask={() => setTaskModal({ open: true, date: dayStr })} onCreatePost={() => setPostModal({ open: true, date: dayStr })} onCreateItem={() => setEventModal({ open: true, date: dayStr })}>
              <button className="h-4 w-4 rounded hover:bg-accent flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground">
                <Plus className="h-3 w-3" />
              </button>
            </QuickCreateMenu>
          )}
        </div>
        <div className="flex flex-col gap-0.5 min-h-0 overflow-y-auto scrollbar-thin">{dayItems.map((item) => renderItemPill(item))}</div>
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
      className={`flex items-center gap-2 text-left rounded-md px-2 py-1.5 hover:bg-accent transition-colors ${dim ? "opacity-60" : ""}`}
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
    <div className="animate-fade-in flex flex-col gap-4 h-full min-h-[600px]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          {viewMode === "month" && (
            <button onClick={() => setParkingOpen(o => !o)} title={parkingOpen ? "Esconder estacionamento" : "Mostrar estacionamento"}
              className="p-1.5 rounded-md hover:bg-accent text-muted-foreground">
              {parkingOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </button>
          )}
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">Calendário</h1>
          <div className="flex items-center gap-1">
            <button onClick={navigatePrev} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"><ChevronLeft className="h-4 w-4" /></button>
            <span className="text-sm font-medium text-foreground min-w-[140px] sm:min-w-[180px] text-center capitalize">{headerLabel()}</span>
            <button onClick={navigateNext} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-md p-0.5">
            {(["month", "week", "day"] as ViewMode[]).map(v => (
              <button key={v} onClick={() => setViewMode(v)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${viewMode === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                {v === "month" ? "Mês" : v === "week" ? "Semana" : "Dia"}
              </button>
            ))}
          </div>
          {isAdmin && (
            <QuickCreateMenu onCreateTask={() => setTaskModal({ open: true })} onCreatePost={() => setPostModal({ open: true })} onCreateItem={() => setEventModal({ open: true })}>
              <button className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
                <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Novo Item</span>
              </button>
            </QuickCreateMenu>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 flex-wrap">
        <FilterChips label="Tipo" options={[
          { value: "task", label: "Tarefas" },
          { value: "post", label: "Marketing" },
          ...(eventTypes.length === 0
            ? [{ value: "event", label: "Eventos" }]
            : eventTypes.map(t => ({ value: `event:${t.name}`, label: t.name }))),
        ]} selected={filterTypes} onChange={setFilterTypes} />
        <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: TASK_COLOR }} /> Tarefa</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: POST_COLOR }} /> Marketing</span>
          {eventTypes.map(t => (
            <span key={t.id} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} /> {t.name}</span>
          ))}
        </div>
        </div>
        {teams.length > 0 && (
          <FilterChips label="Equipe" options={[
            ...teams.map(t => ({ value: t.id, label: t.name })),
            { value: "__none", label: "Sem equipe" },
          ]} selected={filterTeams} onChange={setFilterTeams} />
        )}
      </div>

      {viewMode === "month" && (
        <div className={`grid gap-2 sm:gap-4 flex-1 min-h-0 w-full ${parkingOpen ? "grid-cols-[1fr] lg:grid-cols-[260px_1fr]" : "grid-cols-[28px_1fr] lg:grid-cols-[32px_1fr]"}`}>
          {!parkingOpen && (
            <button
              data-drop-parking="1"
              onClick={() => setParkingOpen(true)}
              onDragOver={handleParkingDragOver}
              onDragLeave={handleParkingDragLeave}
              onDrop={handleParkingDrop}
              title={`Abrir estacionamento (${parkedPosts.length})`}
              className={`group h-full min-h-0 bg-card border rounded-lg flex flex-col items-center justify-start gap-2 py-3 transition-colors hover:bg-accent ${parkingDropActive ? "border-primary ring-2 ring-primary/30 bg-primary/5" : "border-border"}`}
            >
              <Inbox className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
              {parkedPosts.length > 0 && (
                <span className="text-[10px] font-semibold text-foreground bg-muted rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                  {parkedPosts.length}
                </span>
              )}
              <div className="flex-1 flex items-center">
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
                  Estacionamento
                </span>
              </div>
            </button>
          )}
          {parkingOpen && (
            <aside
              data-drop-parking="1"
              onDragOver={handleParkingDragOver}
              onDragLeave={handleParkingDragLeave}
              onDrop={handleParkingDrop}
              className={`bg-card border rounded-lg flex flex-col overflow-hidden h-full min-h-0 transition-colors ${parkingDropActive ? "border-primary ring-2 ring-primary/30 bg-primary/5" : "border-border"}`}
            >
              <div className="px-3 py-2.5 border-b border-border flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-foreground uppercase tracking-wide">Estacionamento</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 truncate">Ideias sem data — arraste para o calendário</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 font-medium">{parkedPosts.length}</span>
                  <button onClick={() => setParkingOpen(false)} title="Recolher estacionamento"
                    className="h-6 w-6 rounded-md hover:bg-accent text-muted-foreground flex items-center justify-center transition-colors">
                    <PanelLeftClose className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {isAdmin && (
                <form onSubmit={handleQuickIdea} className="px-3 py-2 border-b border-border">
                  <input ref={newIdeaRef} value={newIdea} onChange={e => setNewIdea(e.target.value)} placeholder="Nova ideia + Enter"
                    className="w-full bg-muted/50 rounded-md px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60" />
                </form>
              )}
              <div className="flex-1 overflow-y-auto scrollbar-thin p-2 flex flex-col gap-1">
                {parkedPosts.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground/70 text-center py-6 px-2">Nenhuma ideia estacionada</div>
                ) : parkedPosts.map(p => renderItemPill({ id: p.id, title: p.title, type: "post", date: "", time: p.time, color: POST_COLOR, status: p.status }))}
              </div>
            </aside>
          )}
          <div className="bg-card border border-border rounded-lg overflow-hidden flex flex-col h-full min-h-0 w-full">
            <div className="grid grid-cols-7 border-b border-border shrink-0">
              {weekDays.map(d => (<div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">{d}</div>))}
            </div>
            <div className="grid grid-cols-7 flex-1 min-h-0" style={{ gridTemplateRows: `repeat(${monthDays.length / 7}, minmax(0, 1fr))` }}>
              {monthDays.map((day) => (<div key={format(day, "yyyy-MM-dd")} className="group min-h-0">{renderDayCell(day, isSameMonth(day, currentDate))}</div>))}
            </div>
          </div>
        </div>
      )}

      {viewMode === "month" && isMobile && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
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

      {viewMode === "week" && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border">
            <div className="py-2 text-center text-xs text-muted-foreground" />
            {weekDaysList.map(day => (
              <div key={format(day, "yyyy-MM-dd")} className="py-2 text-center">
                <div className="text-xs font-medium text-muted-foreground uppercase">{format(day, "EEE", { locale: ptBR })}</div>
                <div className={`text-sm font-semibold mt-0.5 ${isToday(day) ? "bg-primary text-primary-foreground h-6 w-6 rounded-full flex items-center justify-center mx-auto" : "text-foreground"}`}>{format(day, "d")}</div>
              </div>
            ))}
          </div>
          <div className="max-h-[500px] overflow-y-auto scrollbar-thin">
            {hours.map(h => (
              <div key={h} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border">
                <div className="py-3 text-center text-[10px] text-muted-foreground">{`${h}:00`}</div>
                {weekDaysList.map(day => {
                  const dayStr = format(day, "yyyy-MM-dd");
                  const hourItems = allItems.filter(item => item.date === dayStr && item.time && parseInt(item.time.split(":")[0]) === h);
                  const dropKey = `${dayStr}-${h}`;
                  const isDropping = dropTarget === dropKey;
                  return (
                    <div key={dropKey} onDragOver={(e) => { if (!isAdmin) return; e.preventDefault(); setDropTarget(dropKey); }} onDragLeave={() => setDropTarget(null)}
                      onDrop={(e) => isAdmin && handleDrop(e, dayStr)}
                      className={`border-r border-border p-0.5 min-h-[48px] transition-colors ${isDropping ? "bg-primary/10 ring-2 ring-primary/30 ring-inset" : ""}`}>
                      {hourItems.map(item => renderItemPill(item))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {viewMode === "day" && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <div className={`text-lg font-semibold capitalize ${isToday(currentDate) ? "text-primary" : "text-foreground"}`}>
              {format(currentDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </div>
          </div>
          <div className="max-h-[500px] overflow-y-auto scrollbar-thin">
            {hours.map(h => {
              const dayStr = format(currentDate, "yyyy-MM-dd");
              const hourItems = allItems.filter(item => item.date === dayStr && item.time && parseInt(item.time.split(":")[0]) === h);
              const dropKey = `${dayStr}-${h}`;
              const isDropping = dropTarget === dropKey;
              return (
                <div key={h} onDragOver={(e) => { if (!isAdmin) return; e.preventDefault(); setDropTarget(dropKey); }} onDragLeave={() => setDropTarget(null)}
                  onDrop={(e) => isAdmin && handleDrop(e, dayStr)}
                  className={`flex border-b border-border min-h-[56px] transition-colors ${isDropping ? "bg-primary/10 ring-2 ring-primary/30 ring-inset" : ""}`}>
                  <div className="w-16 shrink-0 py-2 text-center text-xs text-muted-foreground border-r border-border">{`${h}:00`}</div>
                  <div className="flex-1 p-1 flex flex-col gap-0.5">{hourItems.map(item => renderItemPill(item))}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <TaskModal open={taskModal.open} onOpenChange={o => setTaskModal({ open: o })} task={taskModal.task} defaultDate={taskModal.date} />
      <PostModal open={postModal.open} onOpenChange={o => setPostModal({ open: o })} post={postModal.post} defaultDate={postModal.date} />
      <EventModal open={eventModal.open} onOpenChange={o => setEventModal({ open: o })} event={eventModal.event} defaultDate={eventModal.date} />
      <DeleteConfirmDialog open={deleting.open} onOpenChange={o => setDeleting(p => ({ ...p, open: o }))}
        title={deleting.title} onConfirm={handleDelete} />
    </div>
  );
}
