import { useEffect, useState } from "react";
import { useData, type Person } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AREAS } from "@/lib/areas";
import { toast } from "sonner";

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
      await updatePersonAreas(person.id, areas);
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

  const toggleTeam = (teamId: string) => {
    setTeamIds(prev => prev.includes(teamId) ? prev.filter(id => id !== teamId) : [...prev, teamId]);
  };

  const toggleArea = (areaKey: string) => {
    setAreas(prev => prev.includes(areaKey) ? prev.filter(a => a !== areaKey) : [...prev, areaKey]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">

        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">Editar Membro</DialogTitle>
          <p className="text-sm text-muted-foreground">{person.name}</p>
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
              {AREAS.map(areaInfo => (
                <button
                  key={areaInfo.key}
                  type="button"
                  onClick={() => toggleArea(areaInfo.key)}
                  className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all text-left font-medium text-sm`}
                  style={
                    areas.includes(areaInfo.key)
                      ? {
                          borderColor: areaInfo.color,
                          backgroundColor: `${areaInfo.color}20`,
                          color: areaInfo.color,
                        }
                      : {
                          borderColor: "var(--border)",
                          backgroundColor: "var(--muted) / 0.3",
                        }
                  }
                >
                  {areaInfo.label}
                  {areas.includes(areaInfo.key) && <span>✓</span>}
                </button>
              ))}
            </div>
            {areas.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2 italic">Nenhuma área selecionada</p>
            )}
          </div>

          {/* Times */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 block">
              Times
            </label>
            {teams.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum time disponível.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {teams.map(team => (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => toggleTeam(team.id)}
                    className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all text-left font-medium text-sm ${
                      teamIds.includes(team.id)
                        ? "border-blue-500 bg-blue-50 text-blue-900"
                        : "border-border bg-muted/30 hover:bg-muted/50 text-foreground"
                    }`}
                  >
                    {team.name}
                    {teamIds.includes(team.id) && <span className="text-blue-500">✓</span>}
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
              <label className="text-xs font-medium text-muted-foreground mb-3 block">
                Designar como Líder de Área
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLeaderArea("")}
                  className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all text-left font-medium text-sm ${
                    leaderArea === ""
                      ? "border-gray-400 bg-gray-50 text-gray-900"
                      : "border-border bg-muted/30 hover:bg-muted/50 text-foreground"
                  }`}
                >
                  Não é Líder
                  {leaderArea === "" && <span className="text-gray-600">✓</span>}
                </button>

                {AREAS.map(area => (
                  <button
                    key={area.key}
                    type="button"
                    onClick={() => setLeaderArea(area.key)}
                    className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all text-left font-medium text-sm`}
                    style={
                      leaderArea === area.key
                        ? {
                            borderColor: area.color,
                            backgroundColor: `${area.color}20`,
                            color: area.color,
                          }
                        : {
                            borderColor: "var(--border)",
                            backgroundColor: "var(--muted) / 0.3",
                          }
                    }
                  >
                    {area.label}
                    {leaderArea === area.key && <span>✓</span>}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2.5 p-2 bg-muted/30 rounded">
                💡 Líder gerencia demandas apenas de sua área.
              </p>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" className="rounded-lg" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="rounded-lg bg-blue-600 hover:bg-blue-700">
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
