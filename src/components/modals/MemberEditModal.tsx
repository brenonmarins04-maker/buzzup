import { useEffect, useState } from "react";
import { useData, type Person } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AREAS, getTeamColor } from "@/lib/areas";
import { toast } from "sonner";
import { Zap } from "lucide-react";

type Props = { open: boolean; onOpenChange: (o: boolean) => void; person: Person | null };

export default function MemberEditModal({ open, onOpenChange, person }: Props) {
  const { teams, updatePerson, updatePersonAreas, updatePersonLeaderAreas, updateTeam } = useData();
  const { isAdmin } = useAuth();
  const [name, setName] = useState("");
  const [areas, setAreas] = useState<string[]>([]);
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [leaderAreas, setLeaderAreas] = useState<string[]>([]);

  useEffect(() => {
    if (!person) return;
    setName(person.name);
    setAreas(person.areas || (person.area ? [person.area] : []));
    setLeaderAreas(person.leaderAreas || (person.leaderArea ? [person.leaderArea] : []));
    const personTeams = teams.filter(t => t.memberIds.includes(person.id));
    setTeamIds(personTeams.map(t => t.id));
  }, [person, teams, open]);

  if (!person) return null;

  const save = async () => {
    if (!name.trim()) { toast.error("Nome obrigatório"); return; }
    if (name.trim() !== person.name) await updatePerson(person.id, name.trim());
    if (JSON.stringify(areas) !== JSON.stringify(person.areas || (person.area ? [person.area] : []))) {
      await updatePersonAreas(person.id, areas);
    }
    const prevLeader = person.leaderAreas || (person.leaderArea ? [person.leaderArea] : []);
    if (JSON.stringify(leaderAreas) !== JSON.stringify(prevLeader)) {
      await updatePersonLeaderAreas(person.id, leaderAreas);
    }

    // Update teams
    const currentTeamIds = teams.filter(t => t.memberIds.includes(person.id)).map(t => t.id);
    const toRemove = currentTeamIds.filter(id => !teamIds.includes(id));
    const toAdd = teamIds.filter(id => !currentTeamIds.includes(id));

    for (const tid of toRemove) {
      const t = teams.find(tm => tm.id === tid);
      if (t) await updateTeam({ ...t, memberIds: t.memberIds.filter(id => id !== person.id) });
    }
    for (const tid of toAdd) {
      const t = teams.find(tm => tm.id === tid);
      if (t) await updateTeam({ ...t, memberIds: [...t.memberIds, person.id] });
    }

    toast.success("Atualizado");
    onOpenChange(false);
  };

  const toggleArea = (k: string) => setAreas(p => p.includes(k) ? p.filter(a => a !== k) : [...p, k]);
  const toggleTeam = (id: string) => setTeamIds(p => p.includes(id) ? p.filter(t => t !== id) : [...p, id]);
  const toggleLeader = (k: string) => setLeaderAreas(p => p.includes(k) ? p.filter(a => a !== k) : [...p, k]);

  // Compact chip-style selector (more density)
  type Chip = { key: string; label: string; color: string; selected: boolean; onClick: () => void };
  const ChipGrid = ({ chips, cols = 3 }: { chips: Chip[]; cols?: number }) => (
    <div className={`grid gap-1.5`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {chips.map(c => (
        <button
          key={c.key}
          type="button"
          onClick={c.onClick}
          className="flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-all text-left truncate"
          style={c.selected
            ? { backgroundColor: `${c.color}20`, borderColor: c.color, color: c.color }
            : { backgroundColor: "transparent", borderColor: "var(--border)", color: "hsl(var(--foreground))" }}
        >
          <span className="truncate flex-1">{c.label}</span>
          {c.selected && <span className="shrink-0 text-xs">✓</span>}
        </button>
      ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">Editar Assessor</DialogTitle>
          <p className="text-xs text-muted-foreground">{person.name}</p>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-col gap-4">
          {/* Nome */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Nome</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do assessor" className="h-9 rounded-md" />
          </div>

          {/* Áreas de Trabalho */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Áreas de Trabalho</label>
              {areas.length > 0 && <span className="text-[10px] text-muted-foreground">{areas.length} selecionada{areas.length > 1 ? "s" : ""}</span>}
            </div>
            <ChipGrid
              cols={4}
              chips={AREAS.map(a => ({
                key: a.key,
                label: a.label,
                color: a.color,
                selected: areas.includes(a.key),
                onClick: () => toggleArea(a.key),
              }))}
            />
          </div>

          {/* Times */}
          {teams.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Times</label>
                {teamIds.length > 0 && <span className="text-[10px] text-muted-foreground">{teamIds.length} selecionado{teamIds.length > 1 ? "s" : ""}</span>}
              </div>
              <ChipGrid
                cols={3}
                chips={teams.map(t => ({
                  key: t.id,
                  label: t.name,
                  color: getTeamColor(t.id),
                  selected: teamIds.includes(t.id),
                  onClick: () => toggleTeam(t.id),
                }))}
              />
            </div>
          )}

          {/* Configurações de Diretor */}
          {isAdmin && (
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="h-3.5 w-3.5 text-purple-600" />
                <h3 className="text-[10px] font-semibold text-purple-700 uppercase tracking-wide">Cargos de Líder</h3>
                {leaderAreas.length > 0 && (
                  <span className="ml-auto text-[10px] font-semibold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">
                    Líder de {leaderAreas.length}
                  </span>
                )}
              </div>

              {/* Areas as leader */}
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Áreas que lidera</p>
              <ChipGrid
                cols={4}
                chips={AREAS.map(a => ({
                  key: `area-${a.key}`,
                  label: a.label,
                  color: a.color,
                  selected: leaderAreas.includes(a.key),
                  onClick: () => toggleLeader(a.key),
                }))}
              />

              {/* Teams as leader */}
              {teams.length > 0 && (
                <>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-3 mb-1.5">Times que lidera</p>
                  <ChipGrid
                    cols={3}
                    chips={teams.map(t => ({
                      key: `team-${t.id}`,
                      label: t.name,
                      color: getTeamColor(t.id),
                      selected: leaderAreas.includes(`team_${t.id}`),
                      onClick: () => toggleLeader(`team_${t.id}`),
                    }))}
                  />
                </>
              )}

              <p className="text-[10px] text-muted-foreground mt-2 p-2 bg-purple-50 rounded">
                💡 Como líder, pode gerenciar demandas apenas nas áreas/times selecionados.
              </p>
            </div>
          )}

          {/* Ações */}
          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button type="button" variant="outline" className="rounded-md" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="rounded-md bg-primary hover:bg-primary/90">
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
