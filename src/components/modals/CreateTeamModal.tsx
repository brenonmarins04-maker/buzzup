import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

interface CreateTeamModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateTeamModal({ open, onOpenChange }: CreateTeamModalProps) {
  const { people, addTeam } = useData();
  const { myWorkspaces, activeWorkspaceId } = useAuth();
  const navigate = useNavigate();

  const workspaceCode = myWorkspaces.find(w => w.workspace_id === activeWorkspaceId)?.code ?? "";

  const [name, setName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const memberSearchRef = useRef<HTMLInputElement>(null);

  const copyCode = () => {
    if (!workspaceCode) return;
    navigator.clipboard.writeText(workspaceCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setName("");
      setSelectedMembers([]);
      setMemberSearch("");
      setCopied(false);
    }
    onOpenChange(v);
  };

  const toggleMember = (personId: string) => {
    setSelectedMembers(prev =>
      prev.includes(personId) ? prev.filter(id => id !== personId) : [...prev, personId]
    );
  };

  const handleSave = () => {
    if (!name.trim()) return;
    addTeam(name.trim(), selectedMembers);
    handleOpenChange(false);
  };

  const onlyOnePersonInWorkspace = people.length <= 1;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Time</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Nome do time</label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Marketing"
              className="mt-1"
              autoFocus
              onKeyDown={e => { if (e.key === "Enter" && name.trim()) handleSave(); }}
            />
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
                    placeholder="Pesquisar..."
                    className="w-full bg-transparent pl-8 pr-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
                  />
                </div>

                {selectedMembers.length > 0 && (
                  <div className="border-b border-border p-2 flex flex-wrap gap-1.5 bg-muted/30">
                    {selectedMembers.map(id => {
                      const person = people.find(p => p.id === id);
                      if (!person) return null;
                      return (
                        <span key={id} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary rounded-full pl-2.5 pr-1 py-0.5 font-medium">
                          {person.name}
                          <button type="button" onClick={() => toggleMember(id)} className="hover:bg-primary/20 rounded-full p-0.5" title="Remover">
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
                    .map(person => (
                      <label key={person.id} className="flex items-center gap-2 cursor-pointer rounded px-1.5 py-1">
                        <Checkbox
                          checked={selectedMembers.includes(person.id)}
                          onCheckedChange={() => toggleMember(person.id)}
                        />
                        <span className="text-sm text-foreground flex-1">{person.name}</span>
                      </label>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Mensagem de convite — só aparece quando há apenas 1 pessoa no workspace */}
          {onlyOnePersonInWorkspace && workspaceCode && (
            <p className="text-[12px] text-muted-foreground bg-muted/40 rounded-md px-3 py-2.5 leading-relaxed">
              Só tem você aqui? Convide pessoas com seu código do BuzzUp{" "}
              <button
                type="button"
                onClick={copyCode}
                title={copied ? "Copiado!" : "Copiar código"}
                className="inline-flex items-center gap-1 text-primary font-semibold hover:underline focus:underline outline-none"
              >
                {workspaceCode}
                {copied
                  ? <Check className="h-3 w-3" />
                  : <Copy className="h-3 w-3 opacity-70" />}
              </button>{" "}
              e faça a festa! 🎉
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!name.trim()}>Criar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
