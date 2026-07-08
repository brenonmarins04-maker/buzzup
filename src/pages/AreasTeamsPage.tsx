import { Link } from "react-router-dom";
import { useData } from "@/contexts/DataContext";
import { AREAS } from "@/lib/areas";
import { FolderKanban, Briefcase, Sparkles, Crown } from "lucide-react";
import TeamsPage from "@/pages/TeamsPage";

const areaIcons: Record<string, any> = {
  projetos: FolderKanban,
  mercado: Briefcase,
  gg: Sparkles,
  presidencia: Crown,
};

export default function AreasTeamsPage() {
  const { people } = useData();
  const areaCount = (key: string) =>
    people.filter(p => (p.areas && p.areas.includes(key)) || p.area === key).length;

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Áreas e Times</h1>
        <p className="text-sm text-muted-foreground">As áreas fixas do workspace e todos os times.</p>
      </div>

      {/* Áreas */}
      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3">Áreas</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {AREAS.map(a => {
            const Icon = areaIcons[a.key] || FolderKanban;
            return (
              <Link
                key={a.key}
                to={a.path}
                className="group bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow"
                style={{ borderColor: `${a.color}33` }}
              >
                <div className="h-10 w-10 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: `${a.color}1A`, color: a.color }}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="font-semibold text-foreground truncate">{a.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{areaCount(a.key)} pessoa(s)</div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Times — gerenciamento completo */}
      <div className="border-t border-border pt-2">
        <TeamsPage />
      </div>
    </div>
  );
}
