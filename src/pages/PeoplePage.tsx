import { useState, useRef, useMemo, useEffect } from "react";
import { useData, type Person } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Link2, HelpCircle, X, Zap, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { AREAS, getAreaLabel, getTeamColor } from "@/lib/areas";
import MemberEditModal from "@/components/modals/MemberEditModal";
import RolesInfoModal from "@/components/modals/RolesInfoModal";
export default function PeoplePage() {
  const [rolesInfoOpen, setRolesInfoOpen] = useState(false);

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Pessoas</h1>
        <button
          onClick={() => setRolesInfoOpen(true)}
          title="Ver estrutura de cargos"
          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </div>

      <MembersTab />

      <RolesInfoModal open={rolesInfoOpen} onOpenChange={setRolesInfoOpen} />
    </div>
  );
}

function MembersTab() {
  const { people, teams, addPerson, deletePerson } = useData();
  const { isAdmin, activeWorkspaceId } = useAuth();
  const [addModal, setAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<Person | null>(null);
  const [searchText, setSearchText] = useState("");
  const [filterArea, setFilterArea] = useState<string>("");
  const addRef = useRef<HTMLInputElement>(null);

  // Último dia de acesso por usuário (visível a diretores/owners via RLS)
  const [lastAccess, setLastAccess] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!activeWorkspaceId || !isAdmin) return;
    (supabase.from("user_daily_logins") as any)
      .select("user_id, created_at")
      .eq("workspace_id", activeWorkspaceId)
      .order("created_at", { ascending: false })
      .then(({ data }: { data: { user_id: string; created_at: string }[] | null }) => {
        const map: Record<string, string> = {};
        (data || []).forEach(r => { if (!map[r.user_id]) map[r.user_id] = r.created_at; });
        setLastAccess(map);
      });
  }, [activeWorkspaceId, isAdmin]);

  // Cargo por conta vinculada (owner/admin=diretor) + liderança global (leader_areas)
  const [memberRoles, setMemberRoles] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!activeWorkspaceId || !isAdmin) return;
    (supabase.rpc as any)("list_workspace_members", { _ws_id: activeWorkspaceId }).then(({ data }: { data: any[] | null }) => {
      const map: Record<string, string> = {};
      (data || []).forEach((m: any) => { if (m.user_id) map[m.user_id] = m.role; });
      setMemberRoles(map);
    });
  }, [activeWorkspaceId, isAdmin]);

  const roleOf = (p: Person): { label: string; color: string } | null => {
    if (!p.userId) return null;
    const r = memberRoles[p.userId];
    if (r === "owner") return { label: "Owner", color: "#EF9F27" };
    if (r === "admin") return { label: "Diretor", color: "#00B4D8" };
    const hasLeader = (p.leaderAreas && p.leaderAreas.length > 0) || !!p.leaderArea;
    if (hasLeader) return { label: "Líder", color: "#8B5CF6" };
    return { label: "Assessor", color: "#10B981" };
  };

  const filteredPeople = useMemo(() => {
    return people.filter(person => {
      const matchesSearch = person.name.toLowerCase().includes(searchText.toLowerCase());
      let matchesArea = true;
      if (filterArea === "__none__") {
        matchesArea = (!person.areas || person.areas.length === 0) && !person.area;
      } else if (filterArea) {
        matchesArea = person.areas?.includes(filterArea) || (person.area?.includes(filterArea) ?? false);
      }
      return matchesSearch && matchesArea;
    });
  }, [people, searchText, filterArea]);

  const handleAdd = () => {
    if (newName.trim()) {
      addPerson(newName.trim());
      toast.success("Assessor adicionado");
      setNewName("");
      setTimeout(() => addRef.current?.focus(), 50);
    } else {
      toast.error("Nome é obrigatório");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{filteredPeople.length} de {people.length} pessoas</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Pesquisar assessores..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          className="flex-1"
        />
        <select
          value={filterArea}
          onChange={e => setFilterArea(e.target.value)}
          className="w-full sm:w-48 h-9 px-3 rounded-md border border-input bg-background text-sm"
        >
          <option value="">Todas as áreas</option>
          {AREAS.map(a => (
            <option key={a.key} value={a.key}>{a.label}</option>
          ))}
          <option value="__none__">Sem área</option>
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {filteredPeople.map((person) => (
          <div key={person.id} className="group flex items-center justify-between bg-card border border-border rounded-lg px-4 py-3">
            <button
              onClick={() => isAdmin && setEditing(person)}
              disabled={!isAdmin}
              className="flex items-center gap-3 flex-1 min-w-0 text-left disabled:cursor-default"
            >
              <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center text-xs font-semibold text-foreground shrink-0">
                {person.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-medium text-foreground truncate">{person.name}</span>
                  {person.userId && (
                    <span title="Conta vinculada">
                      <Link2 className="h-3 w-3 text-primary shrink-0" />
                    </span>
                  )}
                  {(() => {
                    const rb = roleOf(person);
                    return rb ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: rb.color, backgroundColor: `${rb.color}18`, border: `1px solid ${rb.color}40` }}>
                        {rb.label}
                      </span>
                    ) : null;
                  })()}
                </div>
                {(() => {
                  const personTeams = teams.filter(t => t.memberIds.includes(person.id));
                  const personAreas = person.areas && person.areas.length > 0 ? person.areas : (person.area ? [person.area] : []);
                  return (
                    <div className="flex flex-wrap items-center gap-1 mt-0.5">
                      {personAreas.length > 0 ? (
                        personAreas.map(areaKey => (
                          <span key={areaKey} className="text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded truncate">
                            [{getAreaLabel(areaKey)}]
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-muted-foreground/50 truncate italic">Sem área</span>
                      )}
                      {personTeams.map(t => (
                        <span
                          key={t.id}
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded truncate border"
                          style={{ color: getTeamColor(t.id), borderColor: `${getTeamColor(t.id)}40`, backgroundColor: `${getTeamColor(t.id)}15` }}
                        >
                          [{t.name}]
                        </span>
                      ))}
                    </div>
                  );
                })()}
                {person.userId && lastAccess[person.userId] && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                    <Clock className="h-2.5 w-2.5" /> Último acesso: {new Date(lastAccess[person.userId]).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                  </span>
                )}
              </div>
            </button>
            {isAdmin && !person.userId && (
              <button onClick={() => { deletePerson(person.id); toast.success("Removido"); }}
                className="p-1 ml-2 hover:bg-accent rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                title="Excluir assessor">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {filteredPeople.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          {people.length === 0 ? "Nenhum assessor cadastrado." : "Nenhum assessor encontrado com esses filtros."}
        </p>
      )}

      <Dialog open={addModal} onOpenChange={setAddModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Adicionar assessor</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); handleAdd(); }} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome</label>
              <Input ref={addRef} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome do assessor" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAddModal(false)}>Fechar</Button>
              <Button type="submit">Adicionar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <MemberEditModal open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }} person={editing} />
    </div>
  );
}
