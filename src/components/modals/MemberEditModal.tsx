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
  const { teams, updatePerson, updatePersonArea, updatePersonLeaderArea, updateTeam } = useData();
  const { isAdmin } = useAuth();
  const [name, setName] = useState("");
  const [area, setArea] = useState<string>("");
  const [teamId, setTeamId] = useState<string>("");
  const [leaderArea, setLeaderArea] = useState<string>("");

  useEffect(() => {
    if (!person) return;
    setName(person.name);
    setArea(person.area || "");
    setLeaderArea(person.leaderArea || "");
    const t = teams.find(t => t.memberIds.includes(person.id));
    setTeamId(t?.id || "");
  }, [person, teams, open]);

  if (!person) return null;

  const save = async () => {
    if (!name.trim()) { toast.error("Nome obrigatório"); return; }
    if (name.trim() !== person.name) await updatePerson(person.id, name.trim());
    if ((area || null) !== (person.area || null)) await updatePersonArea(person.id, area || null);
    if ((leaderArea || null) !== (person.leaderArea || null)) await updatePersonLeaderArea(person.id, leaderArea || null);

    const currentTeam = teams.find(t => t.memberIds.includes(person.id));
    const currentTeamId = currentTeam?.id || "";
    if (teamId !== currentTeamId) {
      if (currentTeam) {
        await updateTeam({ ...currentTeam, memberIds: currentTeam.memberIds.filter(id => id !== person.id) });
      }
      if (teamId) {
        const next = teams.find(t => t.id === teamId);
        if (next) await updateTeam({ ...next, memberIds: [...next.memberIds, person.id] });
      }
    }
    toast.success("Atualizado");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Editar membro</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome</label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Área</label>
            <select value={area} onChange={e => setArea(e.target.value)}
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm">
              <option value="">Sem área</option>
              {AREAS.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Equipe</label>
            <select value={teamId} onChange={e => setTeamId(e.target.value)}
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm">
              <option value="">Sem equipe</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          {isAdmin && (
            <div className="border-t pt-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">Configurações de Administrador</p>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Cargo de Líder (selecione uma área)</label>
                <select value={leaderArea} onChange={e => setLeaderArea(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm">
                  <option value="">Não é líder</option>
                  {AREAS.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
                </select>
                <p className="text-[10px] text-muted-foreground mt-1">Se definir uma área, este membro se tornará líder dessa área e poderá gerenciar demandas lá.</p>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}