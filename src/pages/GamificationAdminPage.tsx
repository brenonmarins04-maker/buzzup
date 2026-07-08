import { useMemo, useState, useRef } from "react";
import { useData, type GamificationAction } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Navigate } from "react-router-dom";
import { Trophy, Search, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AREAS_DEFAULT, getAreaLabel } from "@/lib/areas";

type Sub = "pontuar" | "acoes" | "apelidos" | "historico";

export default function GamificationAdminPage() {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;

  const [sub, setSub] = useState<Sub>("pontuar");
  const subs: { v: Sub; label: string }[] = [
    { v: "pontuar", label: "Pontuar" },
    { v: "apelidos", label: "Apelidos" },
    { v: "acoes", label: "Ações rápidas" },
    { v: "historico", label: "Histórico" },
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
      {sub === "historico" && <HistoricoTab />}
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

function PontuarTab() {
  const { people, gamificationActions, awardGamificationPoints, gamificationAwards, deleteGamificationAward } = useData();
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
                    <div key={r.id} className="group flex items-center justify-between gap-2 text-xs text-foreground border-b border-border last:border-0 py-1">
                      <span className="flex-1 truncate">{r.actionName}</span>
                      <span className="text-muted-foreground shrink-0">+{r.points} · {new Date(r.awardedAt).toLocaleString("pt-BR")}</span>
                      <button
                        onClick={async () => {
                          await deleteGamificationAward(r.id);
                          toast.success(`-${r.points} ponto${r.points > 1 ? "s" : ""} removido${r.points > 1 ? "s" : ""}`);
                        }}
                        title="Remover pontuação"
                        className="shrink-0 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
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
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const nicknameRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return people;
    const q = search.toLowerCase();
    return people.filter(p => p.name.toLowerCase().includes(q) || (p.nickname || "").toLowerCase().includes(q));
  }, [people, search]);

  const selectedPerson = selectedId ? people.find(p => p.id === selectedId) : null;

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (filtered.length === 1) {
        // Auto-select the only result
        selectPerson(filtered[0].id);
      } else if (filtered.length > 0) {
        // Select first result
        selectPerson(filtered[0].id);
      }
    }
  };

  const selectPerson = (id: string) => {
    const person = people.find(p => p.id === id);
    if (!person) return;
    setSelectedId(id);
    setNickname(person.nickname || "");
    setTimeout(() => {
      nicknameRef.current?.focus();
      nicknameRef.current?.select();
    }, 50);
  };

  const handleNicknameKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!selectedId) return;
      await updatePersonNickname(selectedId, nickname.trim() || null);
      toast.success(`Apelido de ${selectedPerson?.name} atualizado`);
      // Reset: go back to search, clear and focus
      setSelectedId(null);
      setNickname("");
      setSearch("");
      setTimeout(() => {
        searchRef.current?.focus();
      }, 50);
    }
    if (e.key === "Escape") {
      setSelectedId(null);
      setNickname("");
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search + Edit flow */}
      <div className="bg-card border border-border rounded-lg p-4">
        {!selectedId ? (
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
              Pesquisar pessoa
            </label>
            <Input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Digite o nome e aperte Enter..."
              className="h-10"
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Pesquise → Enter para selecionar → Digite o apelido → Enter para salvar
            </p>

            {/* Counter per area */}
            <NicknameProgressBar people={people} />
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold shrink-0">
                {selectedPerson?.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{selectedPerson?.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  Atual: {selectedPerson?.nickname || <span className="italic">sem apelido</span>}
                </p>
              </div>
              <button
                onClick={() => { setSelectedId(null); setTimeout(() => searchRef.current?.focus(), 50); }}
                className="ml-auto text-xs text-muted-foreground hover:text-foreground"
              >
                ← Voltar
              </button>
            </div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
              Novo apelido
            </label>
            <Input
              ref={nicknameRef}
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              onKeyDown={handleNicknameKeyDown}
              placeholder="Digite o apelido e aperte Enter..."
              className="h-10"
            />
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Enter = salvar e pesquisar outra pessoa · Esc = cancelar
            </p>
          </div>
        )}
      </div>

      {/* Results list (when searching) */}
      {!selectedId && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Pessoa</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Apelido</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr
                  key={p.id}
                  onClick={() => selectPerson(p.id)}
                  className="border-t border-border cursor-pointer hover:bg-accent/50 transition-colors"
                >
                  <td className="px-4 py-2.5 text-foreground font-medium">{p.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {p.nickname || <span className="italic text-muted-foreground/50">sem apelido</span>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-xs text-muted-foreground">
                    {people.length === 0 ? "Nenhuma pessoa cadastrada." : "Nenhum resultado encontrado."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function NicknameProgressBar({ people }: { people: { id: string; name: string; nickname?: string | null; area?: string | null; areas?: string[] | null }[] }) {
  const groups = useMemo(() => {
    const out: { key: string; label: string; color: string; people: typeof people }[] = [];

    AREAS_DEFAULT.forEach(area => {
      const inArea = people.filter(p => {
        if (p.areas && p.areas.length > 0) return p.areas.includes(area.key);
        if (p.area) return p.area.split(",").includes(area.key);
        return false;
      });
      if (inArea.length > 0) {
        out.push({ key: area.key, label: getAreaLabel(area.key), color: area.color, people: inArea });
      }
    });

    const noArea = people.filter(p => {
      if (p.areas && p.areas.length > 0) return false;
      if (p.area && p.area.trim()) return false;
      return true;
    });
    if (noArea.length > 0) {
      out.push({ key: "__none__", label: "Sem área", color: "#94A3B8", people: noArea });
    }

    return out;
  }, [people]);

  if (groups.length === 0) return null;

  return (
    <div className="mt-4 space-y-1.5">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Progresso de apelidos por área</p>
      {groups.map(g => {
        const withNickname = g.people.filter(p => p.nickname && p.nickname.trim());
        const without = g.people.filter(p => !p.nickname || !p.nickname.trim());
        const total = g.people.length;
        const filled = withNickname.length;
        const pct = total === 0 ? 0 : (filled / total) * 100;
        const missingNames = without.map(p => p.name).join(", ");
        const tooltip = without.length > 0
          ? `Faltam: ${missingNames}`
          : "Todos têm apelido ✓";

        return (
          <div key={g.key} title={tooltip}>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
              <span className="text-[11px] font-medium text-foreground flex-1 truncate">{g.label}</span>
              <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                {filled}/{total}
              </span>
            </div>
            <div className="h-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: g.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}