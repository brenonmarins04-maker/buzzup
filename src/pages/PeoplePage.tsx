import { useState, useRef } from "react";
import { useData } from "@/contexts/DataContext";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function PeoplePage() {
  const { people, addPerson, updatePerson, deletePerson } = useData();
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState<{ open: boolean; id: string; name: string }>({ open: false, id: "", name: "" });
  const [newName, setNewName] = useState("");
  const [editName, setEditName] = useState("");
  const addRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    if (newName.trim()) {
      addPerson(newName.trim());
      toast.success("Pessoa adicionada");
      setNewName("");
      setTimeout(() => addRef.current?.focus(), 50);
    } else {
      toast.error("Nome é obrigatório");
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Pessoas</h1>
          <p className="text-sm text-muted-foreground mt-1">{people.length} pessoas no workspace</p>
        </div>
        <button onClick={() => { setAddModal(true); setNewName(""); }}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" /> Nova Pessoa
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {people.map((person) => (
          <div key={person.id} className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-3 group">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center text-xs font-semibold text-foreground">
                {person.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
              </div>
              <span className="text-sm font-medium text-foreground">{person.name}</span>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => { setEditModal({ open: true, id: person.id, name: person.name }); setEditName(person.name); }}
                className="p-1 hover:bg-accent rounded text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={() => { deletePerson(person.id); toast.success("Pessoa removida"); }}
                className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
      </div>

      {people.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhuma pessoa cadastrada. Adicione pessoas para atribuí-las a tarefas, publicações e projetos.</p>
      )}

      {/* Add modal - continuous */}
      <Dialog open={addModal} onOpenChange={setAddModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Adicionar Pessoa</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); handleAdd(); }} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome</label>
              <Input ref={addRef} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome da pessoa" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAddModal(false)}>Fechar</Button>
              <Button type="submit">Adicionar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit modal */}
      <Dialog open={editModal.open} onOpenChange={o => setEditModal(p => ({ ...p, open: o }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Editar Pessoa</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); if (editName.trim()) { updatePerson(editModal.id, editName.trim()); setEditModal({ open: false, id: "", name: "" }); toast.success("Pessoa atualizada"); } }} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome</label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditModal({ open: false, id: "", name: "" })}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
