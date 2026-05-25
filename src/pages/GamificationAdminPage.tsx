import { useState } from "react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Navigate } from "react-router-dom";
import { Trophy } from "lucide-react";
import { toast } from "sonner";

export default function GamificationAdminPage() {
  const { isAdmin } = useAuth();
  const { people, tasks, updatePersonNickname } = useData();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  if (!isAdmin) return <Navigate to="/" replace />;

  const pointsByPerson: Record<string, number> = {};
  tasks.filter(t => t.status === "done").forEach(t => {
    t.responsible.forEach(r => { pointsByPerson[r.id] = (pointsByPerson[r.id] || 0) + (t.points || 0); });
  });

  const save = async (id: string) => {
    const val = drafts[id];
    await updatePersonNickname(id, val ?? null);
    toast.success("Apelido atualizado");
    setDrafts(prev => { const c = { ...prev }; delete c[id]; return c; });
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight flex items-center gap-2">
          <Trophy className="h-6 w-6 text-primary" /> Gerenciamento da Gamificação
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Defina apelidos para exibir no ranking. Deixe em branco para usar o nome real.</p>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Pessoa</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Apelido (ranking)</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Pontos</th>
              <th className="px-4 py-2 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {people.map(p => {
              const draft = drafts[p.id];
              const current = draft !== undefined ? draft : (p.nickname || "");
              const dirty = draft !== undefined && draft !== (p.nickname || "");
              return (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-2 text-foreground">{p.name}</td>
                  <td className="px-4 py-2">
                    <Input
                      value={current}
                      onChange={e => setDrafts(prev => ({ ...prev, [p.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === "Enter") save(p.id); }}
                      placeholder="Anônimo / apelido…"
                      className="h-8"
                    />
                  </td>
                  <td className="px-4 py-2 text-right font-semibold text-foreground">{pointsByPerson[p.id] || 0}</td>
                  <td className="px-4 py-2 text-right">
                    <Button size="sm" variant={dirty ? "default" : "outline"} disabled={!dirty} onClick={() => save(p.id)}>
                      Salvar
                    </Button>
                  </td>
                </tr>
              );
            })}
            {people.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-xs text-muted-foreground">Nenhuma pessoa cadastrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}