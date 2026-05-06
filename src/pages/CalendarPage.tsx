import { useState, useMemo, type DragEvent } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import type { Task, Post, CalendarEvent } from "@/contexts/DataContext";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth,
  addMonths, subMonths, addWeeks, subWeeks, addDays, subDays,
  startOfWeek, endOfWeek, isToday,
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

export type CalendarItem = {
  id: string; title: string; type: "task" | "post" | "event";
  date: string; time?: string; color: string; status?: string;
};

type ViewMode = "month" | "week" | "day";

export default function CalendarPage() {
  const { tasks, posts, events, teams, updateTask, updatePost, updateEvent, deleteTask, deletePost, deleteEvent } = useData();
  const { isAdmin } = useAuth();
  const [currentDate, setCurrentDate] = useState(getNowBrasilia());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [filterTeams, setFilterTeams] = useState<string[]>([]);

  const [taskModal, setTaskModal] = useState<{ open: boolean; task?: Task | null; date?: string }>({ open: false });
  const [postModal, setPostModal] = useState<{ open: boolean; post?: Post | null; date?: string }>({ open: false });
  const [eventModal, setEventModal] = useState<{ open: boolean; event?: CalendarEvent | null; date?: string }>({ open: false });
  const [deleting, setDeleting] = useState<{ open: boolean; id: string; title: string; type: string }>({ open: false, id: "", title: "", type: "" });

  const [dragItem, setDragItem] = useState<CalendarItem | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

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
      items.push({ id: t.id, title: t.title, type: "task", date: t.deadline, color: "bg-team-presidencia", status: t.status });
    });
    posts.forEach((p) => {
      if (filterTypes.length > 0 && !filterTypes.includes("post")) return;
      if (!teamMatch(p.teamId)) return;
      items.push({ id: p.id, title: p.title, type: "post", date: p.date, time: p.time, color: "bg-team-gente", status: p.status });
    });
    events.forEach((e) => {
      if (filterTypes.length > 0 && !filterTypes.includes("event")) return;
      if (!teamMatch(e.teamId)) return;
      items.push({ id: e.id, title: e.title, type: "event", date: e.date, color: "bg-team-mercado" });
    });
    return items;
  }, [tasks, posts, events, filterTypes, filterTeams]);

  const handleDragStart = (e: DragEvent, item: CalendarItem) => {
    setDragItem(item); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", item.id);
    if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = "0.5";
  };
  const handleDragEnd = (e: DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = "1";
    setDragItem(null); setDropTarget(null);
  };
  const handleDragOver = (e: DragEvent, dayStr: string) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDropTarget(dayStr); };
  const handleDragLeave = () => setDropTarget(null);

  const handleDrop = (e: DragEvent, dayStr: string) => {
    e.preventDefault(); setDropTarget(null);
    if (!dragItem) return;
    if (dragItem.type === "task") { const task = tasks.find(t => t.id === dragItem.id); if (task) updateTask({ ...task, deadline: dayStr }); }
    else if (dragItem.type === "post") { const post = posts.find(p => p.id === dragItem.id); if (post) updatePost({ ...post, date: dayStr }); }
    else if (dragItem.type === "event") { const ev = events.find(e => e.id === dragItem.id); if (ev) updateEvent({ ...ev, date: dayStr }); }
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
        <div className="relative group/pill">
          <div draggable onDragStart={(e) => handleDragStart(e, item)} onDragEnd={handleDragEnd}
            onClick={(e) => { e.stopPropagation(); handleItemClick(item); }}
            className={`text-[10px] leading-tight px-1.5 py-0.5 rounded-sm truncate cursor-grab active:cursor-grabbing ${item.color} text-card font-medium hover:opacity-80 transition-opacity pr-4`}>
            {item.title}
          </div>
          <button onClick={(e) => { e.stopPropagation(); setDeleting({ open: true, id: item.id, title: item.title, type: item.type }); }}
            className="absolute top-0 right-0 h-full px-0.5 flex items-center opacity-0 group-hover/pill:opacity-100 transition-opacity">
            <X className="h-2.5 w-2.5 text-card hover:text-destructive" />
          </button>
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs max-w-[200px]">
        <p className="font-semibold">{item.title}</p>
        <p className="text-muted-foreground">{typeLabels[item.type]} • {item.date}{item.time ? ` ${item.time}` : ""}</p>
        {item.status && <p className="text-muted-foreground">Status: {item.status}</p>}
      </TooltipContent>
    </Tooltip>
  );

  const renderDayCell = (day: Date, inMonth: boolean) => {
    const dayStr = format(day, "yyyy-MM-dd");
    const dayItems = allItems.filter((item) => item.date === dayStr);
    const todayFlag = isToday(day);
    const isDropping = dropTarget === dayStr;
    return (
      <div key={dayStr} onDragOver={(e) => handleDragOver(e, dayStr)} onDragLeave={handleDragLeave} onDrop={(e) => handleDrop(e, dayStr)}
        className={`min-h-[100px] border-b border-r border-border p-1.5 transition-colors ${!inMonth ? "bg-muted/30" : ""} ${todayFlag ? "bg-accent/50" : ""} ${isDropping ? "bg-primary/10 ring-2 ring-primary/30 ring-inset" : ""}`}>
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
        <div className="flex flex-col gap-0.5">{dayItems.map((item) => renderItemPill(item))}</div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-4">
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
          { value: "post", label: "Posts" },
          { value: "event", label: "Eventos" },
        ]} selected={filterTypes} onChange={setFilterTypes} />
        <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-team-presidencia" /> Tarefa</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-team-gente" /> Post</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-team-mercado" /> Evento</span>
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
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border">
            {weekDays.map(d => (<div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">{d}</div>))}
          </div>
          <div className="grid grid-cols-7">
            {monthDays.map((day) => (<div key={format(day, "yyyy-MM-dd")} className="group">{renderDayCell(day, isSameMonth(day, currentDate))}</div>))}
          </div>
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
                    <div key={dropKey} onDragOver={(e) => { e.preventDefault(); setDropTarget(dropKey); }} onDragLeave={() => setDropTarget(null)}
                      onDrop={(e) => handleDrop(e, dayStr)}
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
                <div key={h} onDragOver={(e) => { e.preventDefault(); setDropTarget(dropKey); }} onDragLeave={() => setDropTarget(null)}
                  onDrop={(e) => handleDrop(e, dayStr)}
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
