import { useEffect, useState } from "react";
import { useData, type Person } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AREAS } from "@/lib/areas";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

type Props = { open: boolean; onOpenChange: (o: boolean) => void; person: Person | null };

export default function MemberEditModal({ open, onOpenChange, person }: Props) {
  const { teams, updatePerson, updatePersonAreas, updatePersonLeaderArea, updateTeam } = useData();
  const { isAdmin } = useAuth();
  const [name, setName] = useState("");
  const [areas, setAreas] = useState<string[]>([]);
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [leaderArea, setLeaderArea] = useState<string>("");

  useEffect(() => {
    if (!person) return;
    setName(person.name);
    setAreas(person.areas || (person.area ? [person.area] : []));
    setLeaderArea(person.leaderArea || "");
    const personTeams = teams.filter(t => t.memberIds.includes(person.id));
    setTeamIds(personTeams.map(t => t.id));
  }, [person, teams, open]);

  if (!person) return null;

  const save = async () => {
    if (!name.trim()) { toast.error("Nome obrigatório"); return; }
    if (name.trim() !== person.name) await updatePerson(person.id, name.trim());
    if (JSON.stringify(areas) !== JSON.stringify(person.areas || (person.area ? [person.area] : []))) {
      await updatePersonAreas(person.id, areas.length > 0 ? areas : null);
    }
    if ((leaderArea || null) !== (person.leaderArea || null)) await updatePersonLeaderArea(person.id, leaderArea || null);

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

  const toggleArea = (areaKey: string) => {
    setAreas(prev => prev.includes(areaKey) ? prev.filter(a => a !== areaKey) : [...prev, areaKey]);
  };

  const toggleTeam = (teamId: string) => {
    setTeamIds(prev => prev.includes(teamId) ? prev.filter(id => id !== teamId) : [...prev, teamId]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Editar Membro: {person.name}</DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-col gap-5">
          {/* Nome */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
              Nome
            </label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nome do membro"
              className="h-10 rounded-lg"
            />
          </div>

          {/* Áreas (Multiseleção) */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 block">
              Áreas de Trabalho
            </label>
            <div className="grid grid-cols-2 gap-2">
              {AREAS.map(area => (
                <button
                  key={area.key}
                  type="button"
                  onClick={() => toggleArea(area.key)}
                  className={`flex items-center gap-2.5 p-3 rounded-lg border-2 transition-all text-left ${
                    areas.includes(area.key)
                      ? "border-current bg-opacity-10"
                      : "border-border bg-muted/30 hover:bg-muted/50"
                  }`}
                  style={
                    areas.includes(area.key)
                      ? {
                          borderColor: area.color,
                          backgroundColor: `${area.color}15`,
                        }
                      : undefined
                  }
                >
                  <Checkbox
                    checked={areas.includes(area.key)}
                    onChange={() => {}}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-foreground">{area.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Equipes (Multiseleção) */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 block">
              Equipes
            </label>
            {teams.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma equipe disponível.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {teams.map(team => (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => toggleTeam(team.id)}
                    className={`flex items-center gap-2.5 p-3 rounded-lg border-2 transition-all text-left ${
                      teamIds.includes(team.id)
                        ? "border-primary bg-primary/10"
                        : "border-border bg-muted/30 hover:bg-muted/50"
                    }`}
                  >
                    <Checkbox
                      checked={teamIds.includes(team.id)}
                      onChange={() => {}}
                      className="rounded"
                    />
                    <span className="text-sm font-medium text-foreground">{team.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Admin Section */}
          {isAdmin && (
            <div className="border-t pt-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 block">
                ⚙️ Configurações de Administrador
              </h3>

              {/* Cargo de Líder */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-3 block">
                  Designar como Líder de Área
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLeaderArea("")}
                    className={`flex items-center gap-2.5 p-3 rounded-lg border-2 transition-all text-left ${
                      leaderArea === ""
                        ? "border-border bg-muted/50"
                        : "border-border bg-muted/30 hover:bg-muted/50"
                    }`}
                  >
                    <Checkbox
                      checked={leaderArea === ""}
                      onChange={() => {}}
                      className="rounded"
                    />
                    <span className="text-sm font-medium text-foreground">Não é Líder</span>
                  </button>

                  {AREAS.map(area => (
                    <button
                      key={area.key}
                      type="button"
                      onClick={() => setLeaderArea(area.key)}
                      className={`flex items-center gap-2.5 p-3 rounded-lg border-2 transition-all text-left ${
                        leaderArea === area.key
                          ? "border-current bg-opacity-10"
                          : "border-border bg-muted/30 hover:bg-muted/50"
                      }`}
                      style={
                        leaderArea === area.key
                          ? {
                              borderColor: area.color,
                              backgroundColor: `${area.color}15`,
                            }
                          : undefined
                      }
                    >
                      <Checkbox
                        checked={leaderArea === area.key}
                        onChange={() => {}}
                        className="rounded"
                      />
                      <span className="text-sm font-medium text-foreground">{area.label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-2.5 p-2 bg-muted/30 rounded">
                  💡 Líder gerencia demandas apenas de sua área. Cada área pode ter apenas um líder.
                </p>
              </div>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" className="rounded-lg" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="rounded-lg">
              Salvar Alterações
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
