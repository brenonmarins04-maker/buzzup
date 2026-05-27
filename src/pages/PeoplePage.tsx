import { useState, useRef } from "react";
import { useData, type Person } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { AREAS, getAreaLabel } from "@/lib/areas";
import MemberEditModal from "@/components/modals/MemberEditModal";
import TeamsPage from "@/pages/TeamsPage";
import GamificationAdminPage from "@/pages/GamificationAdminPage";

type Tab = "apelidos" | "equipes" | "membros";

export default function PeoplePage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>(isAdmin ? "apelidos" : "membros");

  const tabs: { v: Tab; label: string; show: boolean }[] = [
    { v: "apelidos", label: "Apelidos", show: isAdmin },
    { v: "equipes",  label: "Equipes",  show: true },
    { v: "membros",  label: "Membros",  show: true },
  ];

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Pessoas</h1>
      </div>

      <div className="flex items-center gap-1 border-b border-border">
        {tabs.filter(t => t.show).map(t => (
          <button key={t.v} onClick={() => setTab(t.v)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${tab === t.v ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "apelidos" && isAdmin && <GamificationAdminPage />}
      {tab === "equipes" && <TeamsPage />}
      {tab === "membros" && <MembersTab />}
    </div>
  );
}

function MembersTab() {
  const { people, addPerson, deletePerson } = useData();
  const { isAdmin } = useAuth();
  const [addModal, setAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<Person | null>(null);
  const addRef = useRef<HTMLInputElement>(null);

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
        <p className="text-sm text-muted-foreground">{people.length} membros no workspace</p>
        {isAdmin && (
          <Button size="sm" onClick={() => { setAddModal(true); setNewName(""); }}>
            <Plus className="h-4 w-4 mr-1" /> Novo membro
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {people.map((person) => (
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
                <span className="text-sm font-medium text-foreground truncate">{person.name}</span>
                {person.area && <span className="text-[11px] text-muted-foreground truncate">{getAreaLabel(person.area)}</span>}
              </div>
            </button>
            {isAdmin && (
              <button onClick={() => { deletePerson(person.id); toast.success("Removido"); }}
                className="p-1 ml-2 hover:bg-accent rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {people.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum membro cadastrado.</p>
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
