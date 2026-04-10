import { useState, useMemo, useCallback, useRef, type DragEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import { useData } from "@/contexts/DataContext";
import type { Task, Post, CalendarEvent } from "@/lib/mock-data";
import type { GeneralItem } from "@/contexts/DataContext";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  startOfWeek,
  endOfWeek,
  isToday,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import TaskModal from "@/components/modals/TaskModal";
import PostModal from "@/components/modals/PostModal";
import EventModal from "@/components/modals/EventModal";
import GeneralItemModal from "@/components/modals/GeneralItemModal";
import QuickCreateMenu from "@/components/modals/QuickCreateMenu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type CalendarItem = {
  id: string;
  title: string;
  type: "task" | "post" | "event" | "general";
  date: string;
  time?: string;
  color: string;
  status?: string;
};

type ViewMode = "month" | "week" | "day";

export default function CalendarPage() {
  const { teams, projects, tasks, posts, events, generalItems, updateTask, updatePost, updateEvent, updateGeneralItem } = useData();
  const [currentDate, setCurrentDate] = useState(new Date(2026, 3, 1));
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [filterTeam, setFilterTeam] = useState("all");
  const [filterProject, setFilterProject] = useState("all");
  const [filterType, setFilterType] = useState("all");

  // Modal states
  const [taskModal, setTaskModal] = useState<{ open: boolean; task?: Task | null; date?: string }>({ open: false });
  const [postModal, setPostModal] = useState<{ open: boolean; post?: Post | null; date?: string }>({ open: false });
  const [eventModal, setEventModal] = useState<{ open: boolean; event?: CalendarEvent | null; date?: string }>({ open: false });
  const [generalModal, setGeneralModal] = useState<{ open: boolean; item?: GeneralItem | null; date?: string }>({ open: false });

  // Drag state
  const [dragItem, setDragItem] = useState<CalendarItem | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const allItems = useMemo<CalendarItem[]>(() => {
    const items: CalendarItem[] = [];
    tasks.forEach((t) => {
      if (filterTeam !== "all" && t.teamId !== filterTeam) return;
      if (filterProject !== "all" && t.projectId !== filterProject) return;
      if (filterType !== "all" && filterType !== "task") return;
      items.push({ id: t.id, title: t.title, type: "task", date: t.deadline, color: "bg-team-presidencia", status: t.status });
    });
    posts.forEach((p) => {
      if (filterProject !== "all" && p.projectId !== filterProject) return;
      if (filterType !== "all" && filterType !== "post") return;
      items.push({ id: p.id, title: p.title, type: "post", date: p.date, time: p.time, color: "bg-team-gente", status: p.status });
    });
    events.forEach((e) => {
      if (filterProject !== "all" && e.projectId && e.projectId !== filterProject) return;
      if (filterType !== "all" && filterType !== "event") return;
      items.push({ id: e.id, title: e.name, type: "event", date: e.date, time: e.time, color: "bg-team-mercado" });
    });
    generalItems.forEach((g) => {
      if (filterType !== "all" && filterType !== "general") return;
      items.push({ id: g.id, title: g.title, type: "general", date: g.date, time: g.time, color: "bg-team-projetos" });
    });
    return items;
  }, [tasks, posts, events, generalItems, filterTeam, filterProject, filterType]);

  const handleDragStart = (e: DragEvent, item: CalendarItem) => {
    setDragItem(item);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", item.id);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  };

  const handleDragEnd = (e: DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
    setDragItem(null);
    setDropTarget(null);
  };

  const handleDragOver = (e: DragEvent, dayStr: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(dayStr);
  };

  const handleDragLeave = () => setDropTarget(null);

  const handleDrop = (e: DragEvent, dayStr: string) => {
    e.preventDefault();
    setDropTarget(null);
    if (!dragItem) return;

    // Update the date based on item type
    if (dragItem.type === "task") {
      const task = tasks.find(t => t.id === dragItem.id);
      if (task) updateTask({ ...task, deadline: dayStr });
    } else if (dragItem.type === "post") {
      const post = posts.find(p => p.id === dragItem.id);
      if (post) updatePost({ ...post, date: dayStr });
    } else if (dragItem.type === "event") {
      const ev = events.find(e => e.id === dragItem.id);
      if (ev) updateEvent({ ...ev, date: dayStr });
    } else if (dragItem.type === "general") {
      const gi = generalItems.find(g => g.id === dragItem.id);
      if (gi) updateGeneralItem({ ...gi, date: dayStr });
    }
    setDragItem(null);
  };

  const handleItemClick = (item: CalendarItem) => {
    if (item.type === "task") {
      const task = tasks.find(t => t.id === item.id);
      setTaskModal({ open: true, task });
    } else if (item.type === "post") {
      const post = posts.find(p => p.id === item.id);
      setPostModal({ open: true, post });
    } else if (item.type === "event") {
      const ev = events.find(e => e.id === item.id);
      setEventModal({ open: true, event: ev });
    } else if (item.type === "general") {
      const gi = generalItems.find(g => g.id === item.id);
      setGeneralModal({ open: true, item: gi });
    }
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
  const hours = Array.from({ length: 14 }, (_, i) => i + 7); // 7h to 20h

  // Month view days
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const monthDays = eachDayOfInterval({ start: calStart, end: calEnd });

  // Week view days
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekDaysList = eachDayOfInterval({ start: weekStart, end: endOfWeek(currentDate, { weekStartsOn: 0 }) });

  const typeLabels: Record<string, string> = { task: "Tarefa", post: "Post", event: "Evento", general: "Item" };

  const renderItemPill = (item: CalendarItem, compact = false) => (
    <Tooltip key={item.id}>
      <TooltipTrigger asChild>
        <div
          draggable
          onDragStart={(e) => handleDragStart(e, item)}
          onDragEnd={handleDragEnd}
          onClick={(e) => { e.stopPropagation(); handleItemClick(item); }}
          className={`text-[10px] leading-tight px-1.5 py-0.5 rounded-sm truncate cursor-grab active:cursor-grabbing ${item.color} text-card font-medium hover:opacity-80 transition-opacity ${compact ? "" : ""}`}
        >
          {item.title}
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs max-w-[200px]">
        <p className="font-semibold">{item.title}</p>
        <p className="text-muted-foreground">{typeLabels[item.type]} • {item.date}{item.time ? ` ${item.time}` : ""}</p>
        {item.status && <p className="text-muted-foreground">Status: {item.status}</p>}
      </TooltipContent>
    </Tooltip>
  );

  const renderDayCell = (day: Date, inMonth: boolean, minH = "min-h-[100px]") => {
    const dayStr = format(day, "yyyy-MM-dd");
    const dayItems = allItems.filter((item) => item.date === dayStr);
    const today = isToday(day);
    const isDropping = dropTarget === dayStr;

    return (
      <div
        key={dayStr}
        onDragOver={(e) => handleDragOver(e, dayStr)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, dayStr)}
        className={`${minH} border-b border-r border-border p-1.5 transition-colors ${
          !inMonth ? "bg-muted/30" : ""
        } ${today ? "bg-accent/50" : ""} ${isDropping ? "bg-primary/10 ring-2 ring-primary/30 ring-inset" : ""}`}
      >
        <div className="flex items-center justify-between mb-1">
          <div className={`text-xs font-medium ${
            today
              ? "bg-primary text-primary-foreground h-5 w-5 rounded-full flex items-center justify-center"
              : inMonth ? "text-foreground" : "text-muted-foreground/50"
          }`}>
            {format(day, "d")}
          </div>
          <QuickCreateMenu
            onCreateTask={() => setTaskModal({ open: true, date: dayStr })}
            onCreatePost={() => setPostModal({ open: true, date: dayStr })}
            onCreateEvent={() => setEventModal({ open: true, date: dayStr })}
            onCreateItem={() => setGeneralModal({ open: true, date: dayStr })}
          >
            <button className="h-4 w-4 rounded hover:bg-accent flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground">
              <Plus className="h-3 w-3" />
            </button>
          </QuickCreateMenu>
        </div>
        <div className="flex flex-col gap-0.5">
          {dayItems.slice(0, 3).map((item) => renderItemPill(item))}
          {dayItems.length > 3 && (
            <span className="text-[10px] text-muted-foreground px-1">+{dayItems.length - 3} mais</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Calendário</h1>
          <div className="flex items-center gap-1 ml-4">
            <button onClick={navigatePrev} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium text-foreground min-w-[180px] text-center capitalize">
              {headerLabel()}
            </span>
            <button onClick={navigateNext} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-muted rounded-md p-0.5">
            {(["month", "week", "day"] as ViewMode[]).map(v => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${viewMode === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {v === "month" ? "Mês" : v === "week" ? "Semana" : "Dia"}
              </button>
            ))}
          </div>

          <QuickCreateMenu
            onCreateTask={() => setTaskModal({ open: true })}
            onCreatePost={() => setPostModal({ open: true })}
            onCreateEvent={() => setEventModal({ open: true })}
            onCreateItem={() => setGeneralModal({ open: true })}
          >
            <button className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
              <Plus className="h-4 w-4" /> Novo Item
            </button>
          </QuickCreateMenu>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
          <option value="all">Todas equipes</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
          <option value="all">Todos projetos</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
          <option value="all">Todos tipos</option>
          <option value="task">Tarefas</option>
          <option value="post">Posts</option>
          <option value="event">Eventos</option>
          <option value="general">Itens Gerais</option>
        </select>
        <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-team-presidencia" /> Tarefa</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-team-gente" /> Post</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-team-mercado" /> Evento</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-team-projetos" /> Item</span>
        </div>
      </div>

      {/* Calendar Grid */}
      {viewMode === "month" && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border">
            {weekDays.map(d => (
              <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthDays.map((day) => {
              const inMonth = isSameMonth(day, currentDate);
              return (
                <div key={format(day, "yyyy-MM-dd")} className="group">
                  {renderDayCell(day, inMonth)}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {viewMode === "week" && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border">
            <div className="py-2 text-center text-xs text-muted-foreground" />
            {weekDaysList.map(day => (
              <div key={format(day, "yyyy-MM-dd")} className="py-2 text-center">
                <div className="text-xs font-medium text-muted-foreground uppercase">{format(day, "EEE", { locale: ptBR })}</div>
                <div className={`text-sm font-semibold mt-0.5 ${isToday(day) ? "bg-primary text-primary-foreground h-6 w-6 rounded-full flex items-center justify-center mx-auto" : "text-foreground"}`}>
                  {format(day, "d")}
                </div>
              </div>
            ))}
          </div>
          {/* Time grid */}
          <div className="max-h-[500px] overflow-y-auto scrollbar-thin">
            {hours.map(h => (
              <div key={h} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border">
                <div className="py-3 text-center text-[10px] text-muted-foreground">{`${h}:00`}</div>
                {weekDaysList.map(day => {
                  const dayStr = format(day, "yyyy-MM-dd");
                  const hourItems = allItems.filter(item => item.date === dayStr && item.time && parseInt(item.time.split(":")[0]) === h);
                  const isDropping = dropTarget === `${dayStr}-${h}`;
                  return (
                    <div
                      key={`${dayStr}-${h}`}
                      onDragOver={(e) => { e.preventDefault(); setDropTarget(`${dayStr}-${h}`); }}
                      onDragLeave={() => setDropTarget(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDropTarget(null);
                        if (!dragItem) return;
                        const newTime = `${h.toString().padStart(2, "0")}:00`;
                        if (dragItem.type === "task") {
                          const task = tasks.find(t => t.id === dragItem.id);
                          if (task) updateTask({ ...task, deadline: dayStr });
                        } else if (dragItem.type === "post") {
                          const post = posts.find(p => p.id === dragItem.id);
                          if (post) updatePost({ ...post, date: dayStr, time: newTime });
                        } else if (dragItem.type === "event") {
                          const ev = events.find(e => e.id === dragItem.id);
                          if (ev) updateEvent({ ...ev, date: dayStr, time: newTime });
                        } else if (dragItem.type === "general") {
                          const gi = generalItems.find(g => g.id === dragItem.id);
                          if (gi) updateGeneralItem({ ...gi, date: dayStr, time: newTime });
                        }
                        setDragItem(null);
                      }}
                      className={`border-r border-border p-0.5 min-h-[48px] transition-colors ${isDropping ? "bg-primary/10 ring-2 ring-primary/30 ring-inset" : ""}`}
                    >
                      {hourItems.map(item => renderItemPill(item, true))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          {/* All-day / no-time items */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-t-2 border-border">
            <div className="py-2 text-center text-[10px] text-muted-foreground">Dia</div>
            {weekDaysList.map(day => {
              const dayStr = format(day, "yyyy-MM-dd");
              const noTimeItems = allItems.filter(item => item.date === dayStr && !item.time);
              return (
                <div
                  key={dayStr}
                  onDragOver={(e) => handleDragOver(e, dayStr)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, dayStr)}
                  className={`border-r border-border p-1 min-h-[36px] transition-colors ${dropTarget === dayStr ? "bg-primary/10" : ""}`}
                >
                  {noTimeItems.map(item => renderItemPill(item, true))}
                </div>
              );
            })}
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
          {/* All day items */}
          {(() => {
            const dayStr = format(currentDate, "yyyy-MM-dd");
            const noTimeItems = allItems.filter(item => item.date === dayStr && !item.time);
            return noTimeItems.length > 0 ? (
              <div className="px-4 py-2 border-b border-border bg-muted/30">
                <span className="text-[10px] text-muted-foreground uppercase font-medium">Dia inteiro</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {noTimeItems.map(item => renderItemPill(item))}
                </div>
              </div>
            ) : null;
          })()}
          <div className="max-h-[500px] overflow-y-auto scrollbar-thin">
            {hours.map(h => {
              const dayStr = format(currentDate, "yyyy-MM-dd");
              const hourItems = allItems.filter(item => item.date === dayStr && item.time && parseInt(item.time.split(":")[0]) === h);
              const isDropping = dropTarget === `${dayStr}-${h}`;
              return (
                <div
                  key={h}
                  onDragOver={(e) => { e.preventDefault(); setDropTarget(`${dayStr}-${h}`); }}
                  onDragLeave={() => setDropTarget(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDropTarget(null);
                    if (!dragItem) return;
                    const newTime = `${h.toString().padStart(2, "0")}:00`;
                    if (dragItem.type === "task") {
                      const task = tasks.find(t => t.id === dragItem.id);
                      if (task) updateTask({ ...task, deadline: dayStr });
                    } else if (dragItem.type === "post") {
                      const post = posts.find(p => p.id === dragItem.id);
                      if (post) updatePost({ ...post, date: dayStr, time: newTime });
                    } else if (dragItem.type === "event") {
                      const ev = events.find(e => e.id === dragItem.id);
                      if (ev) updateEvent({ ...ev, date: dayStr, time: newTime });
                    } else if (dragItem.type === "general") {
                      const gi = generalItems.find(g => g.id === dragItem.id);
                      if (gi) updateGeneralItem({ ...gi, date: dayStr, time: newTime });
                    }
                    setDragItem(null);
                  }}
                  className={`flex border-b border-border min-h-[56px] transition-colors ${isDropping ? "bg-primary/10 ring-2 ring-primary/30 ring-inset" : ""}`}
                >
                  <div className="w-16 shrink-0 py-2 text-center text-xs text-muted-foreground border-r border-border">{`${h}:00`}</div>
                  <div className="flex-1 p-1 flex flex-col gap-0.5">
                    {hourItems.map(item => renderItemPill(item))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modals */}
      <TaskModal open={taskModal.open} onOpenChange={o => setTaskModal({ open: o })} task={taskModal.task} defaultDate={taskModal.date} />
      <PostModal open={postModal.open} onOpenChange={o => setPostModal({ open: o })} post={postModal.post} defaultDate={postModal.date} />
      <EventModal open={eventModal.open} onOpenChange={o => setEventModal({ open: o })} event={eventModal.event} defaultDate={eventModal.date} />
      <GeneralItemModal open={generalModal.open} onOpenChange={o => setGeneralModal({ open: o })} item={generalModal.item} defaultDate={generalModal.date} />
    </div>
  );
}
