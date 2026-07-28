import { Link } from "react-router-dom";
import { useData } from "@/contexts/DataContext";
import { AREAS, getAreaLabel } from "@/lib/areas";
import { FolderKanban, Briefcase, Sparkles, Crown, ChevronRight, UsersRound } from "lucide-react";
import TeamsPage from "@/pages/TeamsPage";

const areaIcons: Record<string, typeof FolderKanban> = {
  projetos: FolderKanban,
  mercado: Briefcase,
  gg: Sparkles,
  presidencia: Crown,
};

export default function AreasTeamsPage() {
  const { people, teams } = useData();
  const areaCount = (key: string) =>
    people.filter(p => (p.areas && p.areas.includes(key)) || p.area === key).length;

  return (
    <div className="animate-fade-in space-y-7">
      <div className="page-hero rounded-2xl px-5 py-4 flex items-center gap-3">
        <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <FolderKanban className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Áreas e Times</h1>
          <p className="text-xs text-muted-foreground">Acesse os espaços de trabalho do workspace.</p>
        </div>
      </div>

      <section className="space-y-3" aria-labelledby="areas-heading">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <FolderKanban className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 id="areas-heading" className="text-sm font-bold text-foreground">Áreas</h2>
            <p className="text-xs text-muted-foreground">{AREAS.length} áreas do workspace</p>
          </div>
          <div className="h-px bg-border flex-1" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {AREAS.map(a => {
            const Icon = areaIcons[a.key] || FolderKanban;
            return (
              <Link
                key={a.key}
                to={a.path}
                className="group hover-lift glass-panel-soft rounded-2xl p-4 flex items-center gap-3 transition-all"
                style={{ borderColor: `${a.color}40` }}
              >
                <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${a.color}1A`, color: a.color }}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">{getAreaLabel(a.key)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{areaCount(a.key)} {areaCount(a.key) === 1 ? "pessoa" : "pessoas"}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary shrink-0 transition-colors" />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="times-heading">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <UsersRound className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 id="times-heading" className="text-sm font-bold text-foreground">Times</h2>
            <p className="text-xs text-muted-foreground">{teams.length} {teams.length === 1 ? "time criado" : "times criados"}</p>
          </div>
          <div className="h-px bg-border flex-1" />
        </div>
        <TeamsPage />
      </section>
    </div>
  );
}
