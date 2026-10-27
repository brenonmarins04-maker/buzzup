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
      {/* O título se anuncia pelo nome. O ícone dentro de um quadrado tingido
          era decoração repetida em toda seção — nenhuma das 23 telas de
          produto estudadas faz isso. */}
      <div className="page-hero pb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Áreas e Times</h1>
        <p className="mt-1 text-sm text-muted-foreground">Acesse os espaços de trabalho do workspace.</p>
      </div>

      <section className="space-y-3" aria-labelledby="areas-heading">
        <div className="flex items-baseline gap-2.5">
          <h2 id="areas-heading" className="text-sm font-semibold text-foreground">Áreas</h2>
          <p className="text-xs text-muted-foreground" data-num>{AREAS.length} no workspace</p>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {AREAS.map(a => {
            const Icon = areaIcons[a.key] || FolderKanban;
            return (
              <Link
                key={a.key}
                to={a.path}
                className="group hover-lift flex items-center gap-3 rounded-lg border border-l-[3px] border-border bg-card p-3.5"
                style={{ borderLeftColor: a.color }}
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-foreground">{getAreaLabel(a.key)}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground" data-num>
                    {areaCount(a.key)} {areaCount(a.key) === 1 ? "pessoa" : "pessoas"}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="times-heading">
        <div className="flex items-baseline gap-2.5">
          <h2 id="times-heading" className="text-sm font-semibold text-foreground">Times</h2>
          <p className="text-xs text-muted-foreground" data-num>{teams.length} {teams.length === 1 ? "criado" : "criados"}</p>
          <div className="h-px flex-1 bg-border" />
        </div>
        <TeamsPage />
      </section>
    </div>
  );
}
