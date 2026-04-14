import { useState, useRef } from "react";
import { useData } from "@/contexts/DataContext";
import { Plus, Pencil, Trash2, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function TeamsPage() {
  const { teams, addTeam, deleteTeam, addTeamMember, updateTeamMember, removeTeamMember } = useData();
  const [addModal, setAddModal] = useState<{ open: boolean; teamId: string }>({ open: false, teamId: "" });
  const [editModal, setEditModal] = useState<{ open: boolean; teamId: string; oldName: string }>({ open: false, teamId: "", oldName: "" });
  const [newTeamModal, setNewTeamModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [editName, setEditName] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const addMemberRef = useRef<HTMLInputElement>(null);

  const handleAddMember = () => {
    if (newName.trim()) {
      addTeamMember(addModal.teamId, newName.trim());
      toast.success("Pessoa adicionada");
      setNewName("");
      setTimeout(() => addMemberRef.current?.focus(), 50);
    } else {
      toast.error("Nome é obrigatório");
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Equipes</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie as pessoas de cada equipe</p>
        </div>
        <button onClick={() => { setNewTeamModal(true); setNewTeamName(""); }}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" /> Nova Equipe
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {teams.map((team) => (
          <div key={team.id} className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: team.color }} />
                <h2 className="text-lg font-semibold text-foreground">{team.name}</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded">{team.members.length} pessoas</span>
                <button onClick={() => { deleteTeam(team.id); toast.success("Equipe removida"); }}
                  className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <div className="flex flex-col gap-2 mb-4">
              {team.members.map((member) => (
                <div key={member} className="flex items-center justify-between bg-muted/50 px-3 py-2 rounded-md group">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-accent flex items-center justify-center text-[9px] font-semibold text-foreground">
                      {member.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <span className="text-sm font-medium text-foreground">{member}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditModal({ open: true, teamId: team.id, oldName: member }); setEditName(member); }}
                      className="p-1 hover:bg-accent rounded text-muted-foreground"><Pencil className="h-3 w-3" /></button>
                    <button onClick={() => { removeTeamMember(team.id, member); toast.success("Pessoa removida"); }}
                      className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => { setAddModal({ open: true, teamId: team.id }); setNewName(""); }}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <UserPlus className="h-4 w-4" /> Adicionar pessoa
            </button>
          </div>
        ))}
      </div>

      {/* New team modal */}
      <Dialog open={newTeamModal} onOpenChange={setNewTeamModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova Equipe</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); if (newTeamName.trim()) { addTeam({ name: newTeamName.trim(), color: "#888888", members: [] }); setNewTeamModal(false); toast.success("Equipe criada"); } else { toast.error("Nome é obrigatório"); } }} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome da equipe</label>
              <Input value={newTeamName} onChange={e => setNewTeamName(e.target.value)} placeholder="Nome da equipe" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setNewTeamModal(false)}>Cancelar</Button>
              <Button type="submit">Criar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add member modal - continuous flow */}
      <Dialog open={addModal.open} onOpenChange={o => setAddModal({ open: o, teamId: addModal.teamId })}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Adicionar Pessoa</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); handleAddMember(); }} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome</label>
              <Input ref={addMemberRef} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome da pessoa" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAddModal({ open: false, teamId: "" })}>Fechar</Button>
              <Button type="submit">Adicionar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit member modal */}
      <Dialog open={editModal.open} onOpenChange={o => setEditModal({ open: o, teamId: editModal.teamId, oldName: editModal.oldName })}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Editar Pessoa</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); if (editName.trim()) { updateTeamMember(editModal.teamId, editModal.oldName, editName.trim()); setEditModal({ open: false, teamId: "", oldName: "" }); toast.success("Pessoa atualizada"); } }} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome</label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditModal({ open: false, teamId: "", oldName: "" })}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
