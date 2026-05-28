import { useMemo, useState } from "react";
import { useData, type GamificationAction } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Navigate } from "react-router-dom";
import { Trophy, Search, Plus, Pencil, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Sub = "pontuar" | "acoes" | "apelidos";

export default function GamificationAdminPage() {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;

  const [sub, setSub] = useState<Sub>("pontuar");
  const subs: { v: Sub; label: string }[] = [
    { v: "pontuar", label: "Pontuar" },
    { v: "acoes", label: "Ações" },
    { v: "apelidos", label: "Apelidos" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" /> Gamificação
        </h2>
      </div>
      <div className="flex items-center gap-1 border-b border-border">
        {subs.map(s => (
          <button key={s.v} onClick={() => setSub(s.v)}
            className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors -mb-px ${sub === s.v ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {s.label}
          </button>
        ))}
      </div>
      {sub === "pontuar" && <PontuarTab />}
      {sub === "acoes" && <AcoesTab />}
      {sub === "apelidos" && <ApelidosTab />}
    </div>
  );
}

function PontuarTab() {
  const { people, gamificationActions, awardGamificationPoints, gamificationAwards } = useData();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.filter(p => !q || p.name.toLowerCase().includes(q) || (p.nickname || "").toLowerCase().includes(q));
  }, [people, query]);
  const selected = people.find(p => p.id === selectedId) || null;
  const recent = useMemo(() => selected ? gamificationAwards.filter(a => a.personId === selected.id).slice(0, 5) : [], [gamificationAwards, selected]);
  const totalSelected = useMemo(() => selected ? gamificationAwards.filter(a => a.personId === selected.id).reduce((s, a) => s + a.points, 0) : 0, [gamificationAwards, selected]);

  const give = async (action: GamificationAction) => {
    if (!selected) return;
    await awardGamificationPoints(selected.id, action);
    toast.success(`+${action.points} pts para ${selected.name}`);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
      <div className="bg-card border border-border rounded-lg flex flex-col overflow-hidden">
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar pessoa…" className="h-9 pl-8" autoFocus />
          </div>
        </div>
        <div className="max-h-[480px] overflow-y-auto">
          {filtered.map(p => (
            <button key={p.id} onClick={() => setSelectedId(p.id)}
              className={`w-full text-left px-3 py-2 flex items-center gap-2 border-b border-border last:border-0 hover:bg-accent transition-colors ${selectedId === p.id ? "bg-accent" : ""}`}>
              <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold">
                {p.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
              </div>
              <span className="text-sm text-foreground truncate flex-1">{p.name}</span>
            </button>
          ))}
          {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Nenhuma pessoa.</p>}
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        {!selected ? (
          <p className="text-sm text-muted-foreground text-center py-12">Selecione uma pessoa para pontuar.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-semibold text-foreground">{selected.name}</p>
                <p className="text-xs text-muted-foreground">{totalSelected} pontos no total</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Aplicar ação</p>
              {gamificationActions.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma ação cadastrada — vá para a aba <strong>Ações</strong>.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {gamificationActions.map(a => (
                    <button key={a.id} onClick={() => give(a)}
                      className="group flex items-center justify-between gap-2 bg-background border border-border hover:border-primary rounded-lg px-3 py-2 text-left transition-colors">
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium text-foreground truncate">{a.name}</span>
                        <span className="text-[11px] text-muted-foreground">+{a.points} pts</span>
                      </div>
                      <Check className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            {recent.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Últimas pontuações</p>
                <div className="flex flex-col gap-1">
                  {recent.map(r => (
                    <div key={r.id} className="flex items-center justify-between text-xs text-foreground border-b border-border last:border-0 py-1">
                      <span>{r.actionName}</span>
                      <span className="text-muted-foreground">+{r.points} · {new Date(r.awardedAt).toLocaleString("pt-BR")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AcoesTab() {
  const { gamificationActions, addGamificationAction, updateGamificationAction, deleteGamificationAction } = useData();
  const [modal, setModal] = useState<{ open: boolean; id?: string }>({ open: false });
  const [name, setName] = useState("");
  const [points, setPoints] = useState<number>(10);

  const openNew = () => { setModal({ open: true }); setName(""); setPoints(10); };
  const openEdit = (id: string) => {
    const a = gamificationActions.find(x => x.id === id); if (!a) return;
    setModal({ open: true, id }); setName(a.name); setPoints(a.points);
  };
  const save = async () => {
    if (!name.trim()) { toast.error("Nome obrigatório"); return; }
    if (modal.id) {
      await updateGamificationAction({ id: modal.id, name: name.trim(), points });
      toast.success("Ação atualizada");
    } else {
      await addGamificationAction(name.trim(), points);
      toast.success("Ação criada");
    }
    setModal({ open: false });
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova ação</Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {gamificationActions.map(a => (
          <div key={a.id} className="group flex items-center justify-between bg-card border border-border rounded-lg px-3 py-2">
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium text-foreground truncate">{a.name}</span>
              <span className="text-[11px] text-muted-foreground">+{a.points} pts</span>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => openEdit(a.id)} className="p-1 hover:bg-accent rounded text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={() => { deleteGamificationAction(a.id); toast.success("Removida"); }} className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
        {gamificationActions.length === 0 && <p className="text-xs text-muted-foreground col-span-full text-center py-6">Nenhuma ação criada ainda.</p>}
      </div>

      <Dialog open={modal.open} onOpenChange={(o) => setModal({ open: o })}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{modal.id ? "Editar ação" : "Nova ação"}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome</label>
              <Input value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="Ex: Entrega no prazo" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Pontos</label>
              <Input type="number" value={points} onChange={e => setPoints(parseInt(e.target.value) || 0)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setModal({ open: false })}>Cancelar</Button>
              <Button type="submit">{modal.id ? "Salvar" : "Criar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ApelidosTab() {
  const { people, updatePersonNickname } = useData();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const save = async (id: string) => {
    const val = drafts[id];
    await updatePersonNickname(id, val ?? null);
    toast.success("Apelido atualizado");
    setDrafts(prev => { const c = { ...prev }; delete c[id]; return c; });
  };
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Pessoa</th>
            <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Apelido (ranking)</th>
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
                  <Input value={current}
                    onChange={e => setDrafts(prev => ({ ...prev, [p.id]: e.target.value }))}
                    onKeyDown={e => { if (e.key === "Enter") save(p.id); }}
                    placeholder="Anônimo / apelido…" className="h-8" />
                </td>
                <td className="px-4 py-2 text-right">
                  <Button size="sm" variant={dirty ? "default" : "outline"} disabled={!dirty} onClick={() => save(p.id)}>Salvar</Button>
                </td>
              </tr>
            );
          })}
          {people.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-xs text-muted-foreground">Nenhuma pessoa cadastrada.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}