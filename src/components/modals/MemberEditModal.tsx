import { useEffect, useState } from "react";
import { useData, type Person } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AREAS, getTeamColor } from "@/lib/areas";
import { toast } from "sonner";
import { Eye, Zap, Shield, Crown } from "lucide-react";

type Props = { open: boolean; onOpenChange: (o: boolean) => void; person: Person | null };
type RoleKey = "assessor" | "lider" | "diretor";

export default function MemberEditModal({ open, onOpenChange, person }: Props) {
  const { teams, updatePerson, updatePersonAreas, updatePersonLeaderAreas, updateTeam } = useData();
  const { isAdmin, isOwner, workspaceId } = useAuth();
  const [name, setName] = useState("");
  const [areas, setAreas] = useState<string[]>([]);
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [role, setRole] = useState<RoleKey>("assessor");
  const [wsRole, setWsRole] = useState<string | null>(null); // role real em workspace_members

  const hasAccount = !!person?.userId;
  const isOwnerAccount = wsRole === "owner";

  useEffect(() => {
    if (!person) return;
    setName(person.name);
    setAreas(person.areas || (person.area ? [person.area] : []));
    const personTeams = teams.filter(t => t.memberIds.includes(person.id));
    setTeamIds(personTeams.map(t => t.id));

    const hasLeader = (person.leaderAreas && person.leaderAreas.length > 0) || !!person.leaderArea;
    setRole(hasLeader ? "lider" : "assessor");
    setWsRole(null);
    if (open && person.userId && workspaceId) {
      (supabase.rpc as any)("list_workspace_members", { _ws_id: workspaceId }).then(({ data }: { data: any[] | null }) => {
        const m = (data || []).find((x: any) => x.user_id === person.userId);
        const r = m?.role ?? null;
        setWsRole(r);
        setRole(r === "admin" || r === "owner" ? "diretor" : hasLeader ? "lider" : "assessor");
      });
    }
  }, [person, teams, open, workspaceId]);

  if (!person) return null;

  const save = async () => {
    if (!name.trim()) { toast.error("Nome obrigatório"); return; }
    if (name.trim() !== person.name) await updatePerson(person.id, name.trim());
    if (JSON.stringify(areas) !== JSON.stringify(person.areas || (person.area ? [person.area] : []))) {
      await updatePersonAreas(person.id, areas);
    }

    // Times
    const currentTeamIds = teams.filter(t => t.memberIds.includes(person.id)).map(t => t.id);
    for (const tid of currentTeamIds.filter(id => !teamIds.includes(id))) {
      const t = teams.find(tm => tm.id === tid);
      if (t) await updateTeam({ ...t, memberIds: t.memberIds.filter(id => id !== person.id) });
    }
    for (const tid of teamIds.filter(id => !currentTeamIds.includes(id))) {
      const t = teams.find(tm => tm.id === tid);
      if (t) await updateTeam({ ...t, memberIds: [...t.memberIds, person.id] });
    }

    // Cargo (só conta vinculada; nunca mexe no owner)
    if (person.userId && !isOwnerAccount) {
      const currentLeader = (person.leaderAreas && person.leaderAreas.length > 0) || !!person.leaderArea;
      const currentRole: RoleKey = wsRole === "admin" ? "diretor" : currentLeader ? "lider" : "assessor";
      if (role !== currentRole) {
        const targetWsRole = role === "diretor" ? "admin" : "member";
        const nowWsRole = wsRole === "admin" ? "admin" : "member";
        if (targetWsRole !== nowWsRole) {
          if (!isOwner) {
            toast.error("Só o owner pode promover ou rebaixar Diretor.");
          } else {
            const { error } = await (supabase.rpc as any)("update_member_role", { _ws_id: workspaceId, _target: person.userId, _new_role: targetWsRole });
            if (error) toast.error("Não foi possível alterar o cargo de Diretor.");
          }
        }
        // Líder = líder global (edita qualquer área). Assessor/Diretor = sem liderança.
        const targetLeader = role === "lider" ? AREAS.map(a => a.key) : [];
        await updatePersonLeaderAreas(person.id, targetLeader);
      }
    }

    toast.success("Atualizado");
    onOpenChange(false);
  };

  const toggleArea = (k: string) => setAreas(p => p.includes(k) ? p.filter(a => a !== k) : [...p, k]);
  const toggleTeam = (id: string) => setTeamIds(p => p.includes(id) ? p.filter(t => t !== id) : [...p, id]);

  type Chip = { key: string; label: string; color: string; selected: boolean; onClick: () => void };
  const ChipGrid = ({ chips, cols = 3 }: { chips: Chip[]; cols?: number }) => (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {chips.map(c => (
        <button key={c.key} type="button" onClick={c.onClick}
          className="flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-all text-left truncate"
          style={c.selected
            ? { backgroundColor: `${c.color}20`, borderColor: c.color, color: c.color }
            : { backgroundColor: "transparent", borderColor: "var(--border)", color: "hsl(var(--foreground))" }}>
          <span className="truncate flex-1">{c.label}</span>
          {c.selected && <span className="shrink-0 text-xs">✓</span>}
        </button>
      ))}
    </div>
  );

  const roleOptions: { key: RoleKey; label: string; icon: any; color: string; hint: string; disabled?: boolean }[] = [
    { key: "assessor", label: "Assessor", icon: Eye, color: "#10B981", hint: "Vê suas demandas; não move nem cria." },
    { key: "lider", label: "Líder", icon: Zap, color: "#8B5CF6", hint: "Gerencia demandas em qualquer área." },
    { key: "diretor", label: "Diretor", icon: Shield, color: "#00B4D8", hint: isOwner ? "Acesso administrativo total." : "Só o owner pode definir Diretor.", disabled: !isOwner },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">Editar pessoa</DialogTitle>
          <p className="text-xs text-muted-foreground">{person.name}</p>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-col gap-4">
          {/* Nome */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Nome</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome da pessoa" className="h-9 rounded-md" />
          </div>

          {/* Áreas de Trabalho */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Áreas de Trabalho</label>
              {areas.length > 0 && <span className="text-[10px] text-muted-foreground">{areas.length} selecionada{areas.length > 1 ? "s" : ""}</span>}
            </div>
            <ChipGrid cols={4} chips={AREAS.map(a => ({ key: a.key, label: a.label, color: a.color, selected: areas.includes(a.key), onClick: () => toggleArea(a.key) }))} />
          </div>

          {/* Times */}
          {teams.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Times</label>
                {teamIds.length > 0 && <span className="text-[10px] text-muted-foreground">{teamIds.length} selecionado{teamIds.length > 1 ? "s" : ""}</span>}
              </div>
              <ChipGrid cols={3} chips={teams.map(t => ({ key: t.id, label: t.name, color: getTeamColor(t.id), selected: teamIds.includes(t.id), onClick: () => toggleTeam(t.id) }))} />
            </div>
          )}

          {/* Cargo */}
          {isAdmin && (
            <div className="border-t pt-4">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Cargo</label>
              {!hasAccount ? (
                <p className="text-[11px] text-muted-foreground p-2 bg-muted/40 rounded">Sem conta vinculada — cargo não se aplica a esta pessoa.</p>
              ) : isOwnerAccount ? (
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-md">
                  <Crown className="h-3.5 w-3.5" /> Owner (não alterável)
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {roleOptions.map(opt => {
                      const selected = role === opt.key;
                      const Icon = opt.icon;
                      return (
                        <button key={opt.key} type="button" disabled={opt.disabled}
                          onClick={() => !opt.disabled && setRole(opt.key)}
                          className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg border text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          style={selected
                            ? { backgroundColor: `${opt.color}18`, borderColor: opt.color, color: opt.color }
                            : { backgroundColor: "transparent", borderColor: "var(--border)", color: "hsl(var(--foreground))" }}>
                          <Icon className="h-4 w-4" />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">{roleOptions.find(o => o.key === role)?.hint}</p>
                </>
              )}
            </div>
          )}

          {/* Ações */}
          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button type="button" variant="outline" className="rounded-md" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="rounded-md bg-primary hover:bg-primary/90">Salvar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
