import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useData } from "@/contexts/DataContext";
import { Trophy, Medal, FolderKanban, ListChecks, CalendarDays } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { getNowBrasilia } from "@/lib/utils";
import { addDays, format, endOfWeek, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function DashboardPage() {
  const { people, tasks, projects, events, loading } = useData();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Ranking gamificação
  const doneTasksAll = tasks.filter(t => t.status === "done");
  const pointsByPerson: Record<string, number> = {};
  doneTasksAll.forEach(t => {
    t.responsible.forEach(r => { pointsByPerson[r.id] = (pointsByPerson[r.id] || 0) + (t.points || 0); });
  });
  const ranking = people
    .map(p => ({
      id: p.id,
      label: (p.nickname && p.nickname.trim()) ? p.nickname.trim() : p.name,
      points: pointsByPerson[p.id] || 0,
    }))
    .filter(r => r.points > 0)
    .sort((a, b) => b.points - a.points);

  // Active tasks per person (não começada + em andamento)
  const activeByPerson = people.map(p => {
    let nao = 0, andamento = 0;
    tasks.forEach(t => {
      if (!t.responsible.some(r => r.id === p.id)) return;
      if (t.status === "not-started") nao++;
      else if (t.status === "in-progress") andamento++;
    });
    return { name: p.name.split(" ")[0], fullName: p.name, naoComecada: nao, emAndamento: andamento };
  }).filter(d => d.naoComecada + d.emAndamento > 0)
    .sort((a, b) => (b.naoComecada + b.emAndamento) - (a.naoComecada + a.emAndamento));

  // Active projects
  const activeProjects = projects.filter(p => p.status === "active");

  // Events this week (today → end of week, weekStartsOn = sunday)
  const today = getNowBrasilia();
  const weekEnd = endOfWeek(today, { weekStartsOn: 0 });
  const todayStr = format(today, "yyyy-MM-dd");
  const weekEndStr = format(weekEnd, "yyyy-MM-dd");
  const weekEvents = events
    .filter(e => e.date && e.date >= todayStr && e.date <= weekEndStr)
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Início</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral do workspace</p>
      </div>

      {/* Ranking de Gamificação */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" /> Gamificação — Ranking
        </h2>
        {ranking.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum ponto ainda. Conclua tarefas com pontos atribuídos para entrar no ranking.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {ranking.map((r, i) => {
              const medalColor = i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-700" : "text-muted-foreground";
              return (
                <li key={r.id} className="flex items-center gap-3 p-2.5 rounded-md bg-muted/40">
                  <div className="flex items-center justify-center w-7 h-7 shrink-0">
                    {i < 3 ? <Medal className={`h-5 w-5 ${medalColor}`} /> : <span className="text-xs font-bold text-muted-foreground">{i + 1}</span>}
                  </div>
                  <span className="flex-1 text-sm font-medium text-foreground truncate">{r.label}</span>
                  <span className="text-sm font-bold text-primary">{r.points} pts</span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Projetos ativos */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-muted-foreground" /> Projetos ativos
        </h2>
        {activeProjects.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum projeto ativo.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeProjects.map(p => (
              <div key={p.id} className="border border-border rounded-md p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="text-sm font-medium text-foreground truncate">{p.name}</span>
                </div>
                {p.description && <p className="text-[11px] text-muted-foreground line-clamp-2 mb-1.5">{p.description}</p>}
                <p className="text-[11px] text-muted-foreground">{p.members.length} membro(s)</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tarefas ativas por pessoa */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-muted-foreground" /> Tarefas por pessoa (ativas)
        </h2>
        <div className="h-64">
          {activeByPerson.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              Nenhuma tarefa em andamento ou não começada.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activeByPerson}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 6%, 90%)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(40, 3%, 55%)" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(40, 3%, 55%)" />
                <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(40, 6%, 90%)", fontSize: "12px" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="naoComecada" name="Não começada" fill="#9CA3AF" radius={[4, 4, 0, 0]} />
                <Bar dataKey="emAndamento" name="Em andamento" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Eventos da semana */}
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" /> Eventos da semana
          </h2>
          <Link to="/calendar" className="text-xs text-primary hover:underline">Ver calendário</Link>
        </div>
        {weekEvents.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum evento até o fim da semana.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {weekEvents.map(e => {
              const d = new Date(`${e.date}T00:00:00`);
              const isToday = isSameDay(d, today);
              return (
                <li key={e.id} className="flex items-center gap-3 p-2.5 rounded-md bg-muted/40">
                  <div className="flex flex-col items-center justify-center w-12 shrink-0">
                    <span className="text-[10px] text-muted-foreground uppercase">{format(d, "EEE", { locale: ptBR })}</span>
                    <span className="text-sm font-bold text-foreground">{format(d, "dd/MM")}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{e.title}</p>
                    {e.type && <p className="text-[11px] text-muted-foreground truncate">{e.type}</p>}
                  </div>
                  {isToday && <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Hoje</span>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
