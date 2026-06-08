import { useState, useRef } from "react";
import { useData, type Team } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Pencil, Trash2, UsersRound, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import CreateTeamModal from "@/components/modals/CreateTeamModal";

export default function TeamsPage() {
  const { teams, people, addTeam, updateTeam, deleteTeam, loading } = useData();
  const { isAdmin } = useAuth();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const memberSearchRef = useRef<HTMLInputElement>(null);

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
          <Button onClick={() => setCreateModalOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Novo Time
          </Button>
        )}
      </div>

      {teams.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-10 text-center">
          <UsersRound className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum time criado ainda.</p>
          {isAdmin && (
            <Button onClick={() => setCreateModalOpen(true)} variant="outline" size="sm" className="mt-4">
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
                <p className="text-xs text-muted-foreground mb-2">{members.length} assessor(es)</p>
                <div className="flex flex-wrap gap-1.5">
                  {members.map(m => (
                    <span key={m.id} className="text-xs bg-accent text-foreground px-2 py-0.5 rounded-full">
                      {m.name}
                    </span>
                  ))}
                  {members.length === 0 && (
                    <span className="text-xs text-muted-foreground italic">Sem assessores</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal (shared component) */}
      <CreateTeamModal open={createModalOpen} onOpenChange={setCreateModalOpen} />

      {/* Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Time</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Nome do time</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Marketing" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Assessores</label>
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
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const filtered = people.filter(p => p.name.toLowerCase().includes(memberSearch.toLowerCase()));
                          if (filtered.length > 0) {
                            const first = filtered[0];
                            // Toggle add (don't remove if already selected — keep flow additive)
                            if (!selectedMembers.includes(first.id)) {
                              toggleMember(first.id);
                            }
                            setMemberSearch("");
                            setTimeout(() => memberSearchRef.current?.focus(), 0);
                          }
                        }
                      }}
                      placeholder="Pesquisar e Enter para adicionar..."
                      className="w-full bg-transparent pl-8 pr-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
                    />
                  </div>

                  {/* Selected members chips */}
                  {selectedMembers.length > 0 && (
                    <div className="border-b border-border p-2 flex flex-wrap gap-1.5 bg-muted/30">
                      {selectedMembers.map(id => {
                        const person = people.find(p => p.id === id);
                        if (!person) return null;
                        return (
                          <span key={id} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary rounded-full pl-2.5 pr-1 py-0.5 font-medium">
                            {person.name}
                            <button
                              type="button"
                              onClick={() => toggleMember(id)}
                              className="hover:bg-primary/20 rounded-full p-0.5"
                              title="Remover"
                            >
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <div className="max-h-48 overflow-y-auto space-y-2 p-3">
                    {people
                      .filter(p => p.name.toLowerCase().includes(memberSearch.toLowerCase()))
                      .map((person, idx) => {
                        const isFirst = idx === 0 && memberSearch.trim().length > 0;
                        return (
                          <label
                            key={person.id}
                            className={`flex items-center gap-2 cursor-pointer rounded px-1.5 py-1 ${isFirst ? "bg-primary/5 ring-1 ring-primary/20" : ""}`}
                            onClick={() => {
                              setTimeout(() => memberSearchRef.current?.focus(), 0);
                            }}
                          >
                            <Checkbox
                              checked={selectedMembers.includes(person.id)}
                              onCheckedChange={() => toggleMember(person.id)}
                            />
                            <span className="text-sm text-foreground flex-1">{person.name}</span>
                            {isFirst && (
                              <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">
                                ↵ Enter
                              </span>
                            )}
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Pesquise → Enter para adicionar a primeira pessoa, e continue digitando o próximo nome.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={!name.trim()}>
                Salvar
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
