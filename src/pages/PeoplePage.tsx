import { useState, useRef, useMemo } from "react";
import { useData, type Person } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Trash2, Link2, HelpCircle, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { AREAS, getAreaLabel } from "@/lib/areas";
import MemberEditModal from "@/components/modals/MemberEditModal";
import RolesInfoModal from "@/components/modals/RolesInfoModal";
import TeamsPage from "@/pages/TeamsPage";
import GamificationAdminPage from "@/pages/GamificationAdminPage";

type Tab = "gamificacao" | "historico" | "equipes" | "membros";

export default function PeoplePage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>(isAdmin ? "gamificacao" : "membros");
  const [rolesInfoOpen, setRolesInfoOpen] = useState(false);

  const tabs: { v: Tab; label: string; show: boolean }[] = [
    { v: "gamificacao", label: "Gameficação", show: isAdmin },
    { v: "historico",   label: "Histórico",   show: isAdmin },
    { v: "equipes",     label: "Equipes",     show: true },
    { v: "membros",     label: "Membros",     show: true },
  ];

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Pessoas</h1>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 border-b border-border flex-1">
          {tabs.filter(t => t.show).map(t => (
            <button key={t.v} onClick={() => setTab(t.v)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${tab === t.v ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setRolesInfoOpen(true)}
          title="Ver estrutura de cargos"
          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </div>

      {tab === "gamificacao" && isAdmin && <GamificationAdminPage />}
      {tab === "historico" && isAdmin && <HistoricoTab />}
      {tab === "equipes" && <TeamsPage />}
      {tab === "membros" && <MembersTab />}

      <RolesInfoModal open={rolesInfoOpen} onOpenChange={setRolesInfoOpen} />
    </div>
  );
}

function HistoricoTab() {
  const { gamificationAwards, people, deleteGamificationAward } = useData();
  const groups = useMemo(() => {
    const map = new Map<string, typeof gamificationAwards>();
    [...gamificationAwards]
      .sort((a, b) => b.awardedAt.localeCompare(a.awardedAt))
      .forEach(a => {
        const day = new Date(a.awardedAt).toISOString().slice(0, 10);
        const arr = map.get(day) || [];
        arr.push(a); map.set(day, arr);
      });
    return Array.from(map.entries());
  }, [gamificationAwards]);
  const personName = (id: string) => people.find(p => p.id === id)?.name || "—";

  if (gamificationAwards.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-12">Nenhuma pontuação registrada ainda.</p>;
  }

  return (
    <div className="space-y-5">
      {groups.map(([day, items]) => {
        const total = items.reduce((s, i) => s + i.points, 0);
        return (
          <div key={day}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-foreground">
                {new Date(day + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
              </h3>
              <span className="text-xs text-muted-foreground">{items.length} registros · {total} pts</span>
            </div>
            <div className="bg-card border border-border rounded-lg divide-y divide-border">
              {items.map(a => (
                <div key={a.id} className="flex items-center gap-3 px-3 py-2 group">
                  <span className="text-xs text-muted-foreground w-12 shrink-0">{new Date(a.awardedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="text-sm font-medium text-foreground flex-1 truncate">{personName(a.personId)}</span>
                  <span className="text-sm text-muted-foreground truncate hidden sm:block flex-1">{a.actionName}</span>
                  <span className="text-sm font-semibold text-primary">+{a.points}</span>
                  <button onClick={() => { deleteGamificationAward(a.id); toast.success("Removido"); }}
                    className="p-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MembersTab() {
  const { people, addPerson, deletePerson } = useData();
  const { isAdmin } = useAuth();
  const [addModal, setAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<Person | null>(null);
  const [searchText, setSearchText] = useState("");
  const [filterArea, setFilterArea] = useState<string>("");
  const addRef = useRef<HTMLInputElement>(null);

  const filteredPeople = useMemo(() => {
    return people.filter(person => {
      const matchesSearch = person.name.toLowerCase().includes(searchText.toLowerCase());
      const matchesArea = !filterArea || person.areas?.includes(filterArea) || person.area === filterArea;
      return matchesSearch && matchesArea;
    });
  }, [people, searchText, filterArea]);

  const handleAdd = () => {
    if (newName.trim()) {
      addPerson(newName.trim());
      toast.success("Membro adicionado");
      setNewName("");
      setTimeout(() => addRef.current?.focus(), 50);
    } else {
      toast.error("Nome é obrigatório");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{filteredPeople.length} de {people.length} membros</p>
        {isAdmin && (
          <Button size="sm" onClick={() => { setAddModal(true); setNewName(""); }}>
            <Plus className="h-4 w-4 mr-1" /> Novo membro
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Pesquisar membros..."
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
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-foreground truncate">{person.name}</span>
                  {person.userId && (
                    <span title="Conta vinculada">
                      <Link2 className="h-3 w-3 text-primary shrink-0" />
                    </span>
                  )}
                </div>
                {person.areas && person.areas.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {person.areas.map(areaKey => (
                      <span key={areaKey} className="text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded truncate">
                        {getAreaLabel(areaKey)}
                      </span>
                    ))}
                  </div>
                ) : person.area ? (
                  <span className="text-[11px] text-muted-foreground truncate">{getAreaLabel(person.area)}</span>
                ) : (
                  <span className="text-[11px] text-muted-foreground/50 truncate italic">Sem área</span>
                )}
              </div>
            </button>
            {isAdmin && !person.userId && (
              <button onClick={() => { deletePerson(person.id); toast.success("Removido"); }}
                className="p-1 ml-2 hover:bg-accent rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                title="Excluir membro">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {filteredPeople.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          {people.length === 0 ? "Nenhum membro cadastrado." : "Nenhum membro encontrado com esses filtros."}
        </p>
      )}

      <Dialog open={addModal} onOpenChange={setAddModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Adicionar membro</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); handleAdd(); }} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome</label>
              <Input ref={addRef} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome do membro" />
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
