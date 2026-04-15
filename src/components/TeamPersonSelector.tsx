import { useState } from "react";
import { useData } from "@/contexts/DataContext";
import { ChevronDown, ChevronRight, Users } from "lucide-react";

interface Props {
  selectedIds: string[];
  onToggle: (personId: string) => void;
}

export default function TeamPersonSelector({ selectedIds, onToggle }: Props) {
  const { teams, people } = useData();
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  // People not in any team
  const assignedIds = new Set(teams.flatMap(t => t.memberIds));
  const unassigned = people.filter(p => !assignedIds.has(p.id));

  const toggleExpand = (teamId: string) => {
    setExpandedTeam(prev => prev === teamId ? null : teamId);
  };

  const getTeamMembers = (memberIds: string[]) =>
    people.filter(p => memberIds.includes(p.id));

  const countSelected = (memberIds: string[]) =>
    memberIds.filter(id => selectedIds.includes(id)).length;

  if (teams.length === 0) {
    // Fallback: show people directly if no teams exist
    return (
      <div className="flex flex-wrap gap-1.5">
        {people.map(p => (
          <button key={p.id} type="button" onClick={() => onToggle(p.id)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${selectedIds.includes(p.id) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input text-muted-foreground hover:bg-accent"}`}>
            {p.name}
          </button>
        ))}
        {people.length === 0 && <p className="text-xs text-muted-foreground">Cadastre pessoas primeiro.</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {teams.map(team => {
        const members = getTeamMembers(team.memberIds);
        const selected = countSelected(team.memberIds);
        const isExpanded = expandedTeam === team.id;

        return (
          <div key={team.id} className="border border-border rounded-md overflow-hidden">
            <button
              type="button"
              onClick={() => toggleExpand(team.id)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-accent/50 transition-colors"
            >
              {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="flex-1 text-left">{team.name}</span>
              {selected > 0 && (
                <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">{selected}</span>
              )}
              <span className="text-[10px] text-muted-foreground">{members.length} membros</span>
            </button>
            {isExpanded && (
              <div className="flex flex-wrap gap-1.5 px-3 pb-2.5 pt-1 border-t border-border bg-muted/30">
                {members.map(p => (
                  <button key={p.id} type="button" onClick={() => onToggle(p.id)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${selectedIds.includes(p.id) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input text-muted-foreground hover:bg-accent"}`}>
                    {p.name}
                  </button>
                ))}
                {members.length === 0 && <p className="text-xs text-muted-foreground">Nenhum membro nesta equipe.</p>}
              </div>
            )}
          </div>
        );
      })}

      {unassigned.length > 0 && (
        <div className="border border-border rounded-md overflow-hidden">
          <button
            type="button"
            onClick={() => toggleExpand("__unassigned")}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-accent/50 transition-colors"
          >
            {expandedTeam === "__unassigned" ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            <span className="flex-1 text-left text-muted-foreground">Sem equipe</span>
            {unassigned.filter(p => selectedIds.includes(p.id)).length > 0 && (
              <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                {unassigned.filter(p => selectedIds.includes(p.id)).length}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">{unassigned.length}</span>
          </button>
          {expandedTeam === "__unassigned" && (
            <div className="flex flex-wrap gap-1.5 px-3 pb-2.5 pt-1 border-t border-border bg-muted/30">
              {unassigned.map(p => (
                <button key={p.id} type="button" onClick={() => onToggle(p.id)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${selectedIds.includes(p.id) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input text-muted-foreground hover:bg-accent"}`}>
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
