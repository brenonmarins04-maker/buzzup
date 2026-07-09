import { useState, useMemo, useEffect } from "react";
import { useData, type Person } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, Link2, HelpCircle, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
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
  const { people, teams, deletePerson } = useData();
  const { isAdmin, activeWorkspaceId } = useAuth();
  const [editing, setEditing] = useState<Person | null>(null);
  const [searchText, setSearchText] = useState("");
  const [filterArea, setFilterArea] = useState<string>("");
  const [filterRole, setFilterRole] = useState<string>("");
  const [sortBy, setSortBy] = useState<"nome-asc" | "nome-desc" | "acesso-recente" | "acesso-antigo">("nome-asc");

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

  const roleKeyOf = (p: Person): "owner" | "diretor" | "lider" | "assessor" | null => {
    if (!p.userId) return null;
    const r = memberRoles[p.userId];
    if (r === "owner") return "owner";
    if (r === "admin") return "diretor";
    const hasLeader = (p.leaderAreas && p.leaderAreas.length > 0) || !!p.leaderArea;
    if (hasLeader) return "lider";
    return "assessor";
  };

  const ROLE_META: Record<string, { label: string; color: string }> = {
    owner: { label: "Owner", color: "#EF9F27" },
    diretor: { label: "Diretor", color: "#00B4D8" },
    lider: { label: "Líder", color: "#8B5CF6" },
    assessor: { label: "Assessor", color: "#10B981" },
  };
  const roleOf = (p: Person): { label: string; color: string } | null => {
    const k = roleKeyOf(p);
    return k ? ROLE_META[k] : null;
  };

  const filteredPeople = useMemo(() => {
    const accessMs = (p: Person) => (p.userId && lastAccess[p.userId] ? new Date(lastAccess[p.userId]).getTime() : 0);
    const arr = people.filter(person => {
      const matchesSearch = person.name.toLowerCase().includes(searchText.toLowerCase());
      let matchesArea = true;
      if (filterArea === "__none__") {
        matchesArea = (!person.areas || person.areas.length === 0) && !person.area;
      } else if (filterArea) {
        matchesArea = person.areas?.includes(filterArea) || (person.area?.includes(filterArea) ?? false);
      }
      const matchesRole = !filterRole || roleKeyOf(person) === filterRole;
      return matchesSearch && matchesArea && matchesRole;
    });
    arr.sort((a, b) => {
      switch (sortBy) {
        case "nome-desc": return b.name.localeCompare(a.name, "pt-BR");
        case "acesso-recente": return accessMs(b) - accessMs(a);
        case "acesso-antigo": return accessMs(a) - accessMs(b);
        default: return a.name.localeCompare(b.name, "pt-BR");
      }
    });
    return arr;
  }, [people, searchText, filterArea, filterRole, sortBy, memberRoles, lastAccess]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{filteredPeople.length} de {people.length} pessoas</p>
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-2.5">
        <Input
          placeholder="Pesquisar pessoas..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          className="flex-1 min-w-[180px]"
        />
        <select
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
          className="w-full sm:w-40 h-9 px-3 rounded-md border border-input bg-background text-sm"
        >
          <option value="">Todos os cargos</option>
          <option value="diretor">Diretor</option>
          <option value="lider">Líder</option>
          <option value="assessor">Assessor</option>
          <option value="owner">Owner</option>
        </select>
        <select
          value={filterArea}
          onChange={e => setFilterArea(e.target.value)}
          className="w-full sm:w-44 h-9 px-3 rounded-md border border-input bg-background text-sm"
        >
          <option value="">Todas as áreas</option>
          {AREAS.map(a => (
            <option key={a.key} value={a.key}>{a.label}</option>
          ))}
          <option value="__none__">Sem área</option>
        </select>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as typeof sortBy)}
          className="w-full sm:w-52 h-9 px-3 rounded-md border border-input bg-background text-sm"
        >
          <option value="nome-asc">Ordem alfabética (A–Z)</option>
          <option value="nome-desc">Ordem alfabética (Z–A)</option>
          <option value="acesso-recente">Último acesso (recente)</option>
          <option value="acesso-antigo">Último acesso (antigo)</option>
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {filteredPeople.map((person) => {
          const rb = roleOf(person);
          const accent = rb?.color ?? "#00B4D8";
          const initials = person.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
          const personTeams = teams.filter(t => t.memberIds.includes(person.id));
          const personAreas = person.areas && person.areas.length > 0 ? person.areas : (person.area ? [person.area] : []);
          return (
            <div
              key={person.id}
              onClick={() => { if (isAdmin) setEditing(person); }}
              className={`group relative overflow-hidden rounded-2xl border border-border bg-card p-4 transition-all duration-200 ${isAdmin ? "cursor-pointer hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10" : ""}`}
            >
              {/* faixa lateral de cor por cargo */}
              <span className="pointer-events-none absolute left-0 top-0 h-full w-1" style={{ background: `linear-gradient(to bottom, ${accent}, ${accent}00)` }} />
              {/* brilho ciano no hover */}
              <span className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-primary/10 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />

              <div className="relative flex items-start gap-3">
                <div
                  className="h-11 w-11 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ring-2 ring-background shadow-md"
                  style={{ background: `linear-gradient(135deg, ${accent}, #00B4D8)` }}
                >
                  {initials}
                </div>

                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold text-foreground truncate">{person.name}</span>
                    {person.userId && (
                      <span title="Conta vinculada">
                        <Link2 className="h-3 w-3 text-primary shrink-0" />
                      </span>
                    )}
                    {rb && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: rb.color, backgroundColor: `${rb.color}1a`, border: `1px solid ${rb.color}40` }}>
                        {rb.label}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1 mt-1.5">
                    {personAreas.length > 0 ? (
                      personAreas.map(areaKey => (
                        <span key={areaKey} className="text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full truncate">
                          {getAreaLabel(areaKey)}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-muted-foreground/50 truncate italic">Sem área</span>
                    )}
                    {personTeams.map(t => (
                      <span
                        key={t.id}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full truncate border"
                        style={{ color: getTeamColor(t.id), borderColor: `${getTeamColor(t.id)}40`, backgroundColor: `${getTeamColor(t.id)}15` }}
                      >
                        {t.name}
                      </span>
                    ))}
                  </div>

                  {person.userId && lastAccess[person.userId] && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground mt-2">
                      <Clock className="h-2.5 w-2.5" /> Último acesso: {new Date(lastAccess[person.userId]).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                    </span>
                  )}
                </div>

                {isAdmin && !person.userId && (
                  <button
                    onClick={(e) => { e.stopPropagation(); deletePerson(person.id); toast.success("Removido"); }}
                    className="relative p-1 hover:bg-accent rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    title="Excluir assessor"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredPeople.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          {people.length === 0 ? "Nenhum assessor cadastrado." : "Nenhum assessor encontrado com esses filtros."}
        </p>
      )}

      <MemberEditModal open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }} person={editing} />
    </div>
  );
}
