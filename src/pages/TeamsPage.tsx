import { useState, useRef } from "react";
import { useData, type Team } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Pencil, Trash2, UsersRound, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";

export default function TeamsPage() {
  const { teams, people, addTeam, updateTeam, deleteTeam, loading } = useData();
  const { isAdmin } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const memberSearchRef = useRef<HTMLInputElement>(null);

  const openCreate = () => {
    setEditingTeam(null);
    setName("");
    setSelectedMembers([]);
    setMemberSearch("");
    setModalOpen(true);
  };

  const openEdit = (team: Team) => {
    setEditingTeam(team);
    setName(team.name);
    setSelectedMembers([...team.memberIds]);
    setMemberSearch("");
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    if (editingTeam) {
      updateTeam({ id: editingTeam.id, name: name.trim(), memberIds: selectedMembers });
    } else {
      addTeam(name.trim(), selectedMembers);
    }
    setModalOpen(false);
  };

  const toggleMember = (personId: string) => {
    setSelectedMembers(prev =>
      prev.includes(personId) ? prev.filter(id => id !== personId) : [...prev, personId]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Times</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie seus times e membros</p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Novo Time
          </Button>
        )}
      </div>

      {teams.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-10 text-center">
          <UsersRound className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum time criado ainda.</p>
          {isAdmin && (
            <Button onClick={openCreate} variant="outline" size="sm" className="mt-4">
              <Plus className="h-4 w-4 mr-1" /> Criar time
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map(team => {
            const members = people.filter(p => team.memberIds.includes(p.id));
            return (
              <div key={team.id} className="bg-card border border-border rounded-lg p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-foreground">{team.name}</h3>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(team)} className="p-1.5 rounded hover:bg-accent text-muted-foreground">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setDeleteId(team.id)} className="p-1.5 rounded hover:bg-accent text-muted-foreground">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-2">{members.length} membro(s)</p>
                <div className="flex flex-wrap gap-1.5">
                  {members.map(m => (
                    <span key={m.id} className="text-xs bg-accent text-foreground px-2 py-0.5 rounded-full">
                      {m.name}
                    </span>
                  ))}
                  {members.length === 0 && (
                    <span className="text-xs text-muted-foreground italic">Sem membros</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTeam ? "Editar Time" : "Novo Time"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Nome do time</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Marketing" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Membros</label>
              {people.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma pessoa cadastrada.</p>
              ) : (
                <div className="border border-border rounded-md">
                  <div className="relative border-b border-border">
                    <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      ref={memberSearchRef}
                      value={memberSearch}
                      onChange={e => setMemberSearch(e.target.value)}
                      placeholder="Pesquisar pessoa..."
                      className="w-full bg-transparent pl-8 pr-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2 p-3">
                    {people
                      .filter(p => p.name.toLowerCase().includes(memberSearch.toLowerCase()))
                      .map(person => (
                        <label
                          key={person.id}
                          className="flex items-center gap-2 cursor-pointer"
                          onClick={() => {
                            setTimeout(() => memberSearchRef.current?.select(), 0);
                          }}
                        >
                          <Checkbox
                            checked={selectedMembers.includes(person.id)}
                            onCheckedChange={() => toggleMember(person.id)}
                          />
                          <span className="text-sm text-foreground">{person.name}</span>
                        </label>
                      ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={!name.trim()}>
                {editingTeam ? "Salvar" : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <DeleteConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        onConfirm={() => { if (deleteId) { deleteTeam(deleteId); setDeleteId(null); } }}
        title="time"
      />
    </div>
  );
}
