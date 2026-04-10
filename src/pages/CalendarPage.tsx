import { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import { tasks, posts, calendarEvents, teams, projects } from "@/lib/mock-data";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isToday,
} from "date-fns";
import { ptBR } from "date-fns/locale";

type CalendarItem = {
  id: string;
  title: string;
  type: "task" | "post" | "event";
  date: string;
  color: string;
  status?: string;
};

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 3, 1)); // April 2026
  const [filterTeam, setFilterTeam] = useState("all");
  const [filterProject, setFilterProject] = useState("all");
  const [filterType, setFilterType] = useState("all");

  const allItems = useMemo<CalendarItem[]>(() => {
    const items: CalendarItem[] = [];

    tasks.forEach((t) => {
      if (filterTeam !== "all" && t.teamId !== filterTeam) return;
      if (filterProject !== "all" && t.projectId !== filterProject) return;
      if (filterType !== "all" && filterType !== "task") return;
      items.push({
        id: t.id,
        title: t.title,
        type: "task",
        date: t.deadline,
        color: "bg-team-presidencia",
        status: t.status,
      });
    });

    posts.forEach((p) => {
      if (filterProject !== "all" && p.projectId !== filterProject) return;
      if (filterType !== "all" && filterType !== "post") return;
      items.push({
        id: p.id,
        title: p.title,
        type: "post",
        date: p.date,
        color: "bg-team-gente",
        status: p.status,
      });
    });

    calendarEvents.forEach((e) => {
      if (filterProject !== "all" && e.projectId && e.projectId !== filterProject) return;
      if (filterType !== "all" && filterType !== "event") return;
      items.push({
        id: e.id,
        title: e.name,
        type: "event",
        date: e.date,
        color: "bg-team-mercado",
      });
    });

    return items;
  }, [filterTeam, filterProject, filterType]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <div className="animate-fade-in space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Calendário</h1>
          <div className="flex items-center gap-1 ml-4">
            <button
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="p-1.5 rounded-md hover:bg-accent text-muted-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium text-foreground min-w-[140px] text-center capitalize">
              {format(currentDate, "MMMM yyyy", { locale: ptBR })}
            </span>
            <button
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="p-1.5 rounded-md hover:bg-accent text-muted-foreground transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <button className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" /> Novo Item
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={filterTeam}
          onChange={(e) => setFilterTeam(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">Todas equipes</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">Todos projetos</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">Todos tipos</option>
          <option value="task">Tarefas</option>
          <option value="post">Posts</option>
          <option value="event">Eventos</option>
        </select>

        {/* Legend */}
        <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-team-presidencia" /> Tarefa</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-team-gente" /> Post</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-team-mercado" /> Evento</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-7 border-b border-border">
          {weekDays.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const dayStr = format(day, "yyyy-MM-dd");
            const dayItems = allItems.filter((item) => item.date === dayStr);
            const inMonth = isSameMonth(day, currentDate);
            const today = isToday(day);

            return (
              <div
                key={i}
                className={`min-h-[100px] border-b border-r border-border p-1.5 ${
                  !inMonth ? "bg-muted/30" : ""
                } ${today ? "bg-accent/50" : ""}`}
              >
                <div className={`text-xs font-medium mb-1 ${
                  today
                    ? "bg-primary text-primary-foreground h-5 w-5 rounded-full flex items-center justify-center"
                    : inMonth
                    ? "text-foreground"
                    : "text-muted-foreground/50"
                }`}>
                  {format(day, "d")}
                </div>
                <div className="flex flex-col gap-0.5">
                  {dayItems.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className={`text-[10px] leading-tight px-1.5 py-0.5 rounded-sm truncate cursor-pointer ${item.color} text-card font-medium hover:opacity-80 transition-opacity`}
                    >
                      {item.title}
                    </div>
                  ))}
                  {dayItems.length > 3 && (
                    <span className="text-[10px] text-muted-foreground px-1">
                      +{dayItems.length - 3} mais
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
