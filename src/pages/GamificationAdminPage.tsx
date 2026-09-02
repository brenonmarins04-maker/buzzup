import { useMemo, useState, useRef, useEffect } from "react";
import { useData, type GamificationAction } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Navigate } from "react-router-dom";
import { Trophy, Search, Plus, Pencil, Trash2, Check, X, RotateCcw, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AREAS, getAreaLabel } from "@/lib/areas";
import {
  groupPeopleByArea, peopleForReset, progressOf, SEM_AREA, TODAS_AS_AREAS,
  type NickPerson,
} from "@/lib/nicknames";
import { useIsMobile } from "@/hooks/use-mobile";
import { matchesSearch } from "@/lib/utils";
import { useDemandPoints } from "@/hooks/useDemandPoints";
import { MAX_DEMAND_POINT_OPTIONS } from "@/lib/demandPoints";

type Sub = "pontuar" | "acoes" | "demandas" | "apelidos" | "historico";

export default function GamificationAdminPage() {
  const { isAdmin, hubStatus } = useAuth();
  const [sub, setSub] = useState<Sub>("pontuar");
  if (hubStatus === "idle" || hubStatus === "loading") {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/" replace />;
  const subs: { v: Sub; label: string }[] = [
    { v: "pontuar", label: "Pontuar" },
    { v: "apelidos", label: "Apelidos" },
    { v: "acoes", label: "Ações rápidas" },
    { v: "demandas", label: "Pontuação por demandas" },
    { v: "historico", label: "Histórico" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" /> Gamificação
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted/40 p-1 sm:flex sm:items-center sm:gap-1 sm:rounded-none sm:border-b sm:border-border sm:bg-transparent sm:p-0">
        {subs.map(s => (
          <button key={s.v} onClick={() => setSub(s.v)}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors sm:-mb-px sm:rounded-none sm:border-b-2 sm:py-1.5 sm:text-sm ${sub === s.v ? "bg-background text-foreground shadow-sm sm:border-primary sm:bg-transparent sm:shadow-none" : "text-muted-foreground hover:text-foreground sm:border-transparent"}`}>
            {s.label}
          </button>
        ))}
      </div>
      {sub === "pontuar" && <PontuarTab />}
      {sub === "acoes" && <AcoesTab />}
      {sub === "demandas" && <DemandasTab />}
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
  const isMobile = useIsMobile();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [awardingActionId, setAwardingActionId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.filter(p => !q || matchesSearch(p.name, q) || matchesSearch(p.nickname, q));
  }, [people, query]);
  const visiblePeople = isMobile && !query.trim() ? [] : filtered;
  const selected = people.find(p => p.id === selectedId) || null;
  const recent = useMemo(() => selected ? gamificationAwards.filter(a => a.personId === selected.id).slice(0, 5) : [], [gamificationAwards, selected]);
  const totalSelected = useMemo(() => selected ? gamificationAwards.filter(a => a.personId === selected.id).reduce((s, a) => s + a.points, 0) : 0, [gamificationAwards, selected]);

  const focusAndSelectSearch = () => {
    requestAnimationFrame(() => {
      searchRef.current?.focus({ preventScroll: true });
      searchRef.current?.select();
    });
  };

  const selectPerson = (personId: string) => {
    const person = people.find(item => item.id === personId);
    if (!person) return;
    setSelectedId(person.id);
    setQuery(person.name);
    focusAndSelectSearch();
    if (isMobile) {
      setTimeout(() => actionsRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }), 80);
    }
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (filtered.length > 0) selectPerson(filtered[0].id);
  };

  const give = async (action: GamificationAction) => {
    if (!selected) return;
    setAwardingActionId(action.id);
    try {
      await awardGamificationPoints(selected.id, action);
      toast.success(`+${action.points} pts para ${selected.name}`);
      setQuery(selected.name);
      focusAndSelectSearch();
    } finally {
      setAwardingActionId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
      <div className="glass-panel-soft rounded-2xl flex flex-col overflow-hidden">
        <div className="p-3 border-b border-border">
          {isMobile && <label htmlFor="gamification-person-search" className="mb-2 block text-xs font-semibold text-foreground">Quem você quer pontuar?</label>}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              id="gamification-person-search"
              ref={searchRef}
              value={query}
              onChange={event => {
                setQuery(event.target.value);
                if (selectedId) setSelectedId(null);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Digite o nome e aperte Enter"
              className="h-11 pl-8 text-base md:h-9 md:text-sm"
              autoFocus
              autoComplete="off"
            />
          </div>
          {isMobile && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Enter seleciona a primeira pessoa encontrada.
            </p>
          )}
        </div>
        <div className={`${isMobile ? "max-h-60" : "max-h-[480px]"} overflow-y-auto`}>
          {visiblePeople.map(p => (
            <button key={p.id} onClick={() => selectPerson(p.id)}
              className={`w-full text-left px-3 py-2.5 flex items-center gap-2 border-b border-border last:border-0 hover:bg-accent transition-colors ${selectedId === p.id ? "bg-primary/10" : ""}`}>
              <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold">
                {p.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
              </div>
              <span className="text-sm text-foreground truncate flex-1">{p.name}</span>
              {p.nickname && <span className="text-[10px] text-muted-foreground truncate">{p.nickname}</span>}
            </button>
          ))}
          {query.trim() && visiblePeople.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Nenhuma pessoa encontrada.</p>}
        </div>
      </div>

      <div ref={actionsRef} className="glass-panel-soft scroll-mt-16 rounded-2xl p-4">
        {!selected ? (
          <div className="py-10 text-center">
            <Search className="mx-auto mb-2 h-7 w-7 text-primary/50" />
            <p className="text-sm font-medium text-foreground">Pesquise e aperte Enter</p>
            <p className="mt-1 text-xs text-muted-foreground">As ações de pontuação aparecerão aqui.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Pessoa selecionada</p>
                <p className="text-base font-semibold text-foreground">{selected.name}</p>
                <p className="text-xs text-muted-foreground">{totalSelected} pontos no total</p>
              </div>
              <Check className="h-5 w-5 shrink-0 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground mb-2">Escolha uma ação</p>
              {gamificationActions.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma ação cadastrada — vá para a aba <strong>Ações</strong>.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {gamificationActions.map(a => (
                    <button key={a.id} onClick={() => give(a)} disabled={awardingActionId === a.id}
                      className="group flex min-h-12 items-center justify-between gap-2 bg-background border border-border hover:border-primary rounded-xl px-3 py-2.5 text-left transition-colors disabled:opacity-60">
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-foreground break-words">{a.name}</span>
                        <span className="text-xs font-semibold text-primary">+{a.points} pts</span>
                      </div>
                      <Plus className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
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
  const { people, updatePersonNickname, resetPersonNicknames } = useData();
  const [resetOpen, setResetOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const nicknameRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return people;
    const q = search.toLowerCase();
    return people.filter(p => matchesSearch(p.name, q) || matchesSearch(p.nickname, q));
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
            <div className="flex items-center gap-2">
              <Input
                ref={searchRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Digite o nome e aperte Enter..."
                className="h-10 flex-1"
                autoFocus
              />
              <Button
                variant="outline"
                onClick={() => setResetOpen(true)}
                className="h-10 shrink-0"
              >
                <RotateCcw className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Resetar</span>
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Pesquise → Enter para selecionar → Digite o apelido → Enter para salvar
            </p>

            {/* Preenchimento por área — clique numa área para ver os nomes */}
            <NicknameByArea people={people} onSelectPerson={selectPerson} />
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

      <ResetNicknamesDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        people={people}
        onReset={resetPersonNicknames}
      />

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

/**
 * Preenchimento de apelidos por área. Cada área abre mostrando os nomes de
 * quem ainda não tem apelido — antes isso só existia como tooltip, que não dá
 * para ler no celular nem clicar.
 */
function NicknameByArea({
  people, onSelectPerson,
}: {
  people: NickPerson[];
  onSelectPerson: (id: string) => void;
}) {
  const [aberta, setAberta] = useState<string | null>(null);

  const groups = useMemo(
    () => groupPeopleByArea(people, AREAS.map(a => ({ key: a.key, label: getAreaLabel(a.key), color: a.color }))),
    [people],
  );

  if (groups.length === 0) return null;

  return (
    <div className="mt-4 space-y-1.5">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        Apelidos por área — toque para ver quem falta
      </p>

      {groups.map(g => {
        const { filled, total, pct } = progressOf(g);
        const expandida = aberta === g.key;
        const completa = g.semApelido.length === 0;

        return (
          <div key={g.key} className="rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setAberta(expandida ? null : g.key)}
              aria-expanded={expandida}
              className="w-full px-2.5 py-2 text-left hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {expandida
                  ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                <span className="text-[11px] font-medium text-foreground flex-1 truncate">{g.label}</span>
                {completa ? (
                  <span className="text-[10px] font-bold text-emerald-500">completo</span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-500">
                    {g.semApelido.length} sem apelido
                  </span>
                )}
                <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                  {filled}/{total}
                </span>
              </div>
              <div className="h-1 rounded-full bg-muted overflow-hidden mt-1">
                <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: g.color }} />
              </div>
            </button>

            {expandida && (
              <div className="border-t border-border bg-muted/20 px-2.5 py-2 space-y-2">
                {g.semApelido.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider mb-1">
                      Sem apelido ({g.semApelido.length})
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {g.semApelido.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => onSelectPerson(p.id)}
                          title={`Definir o apelido de ${p.name}`}
                          className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-amber-500/30 transition-colors"
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {g.comApelido.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                      Já têm ({g.comApelido.length})
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {g.comApelido.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => onSelectPerson(p.id)}
                          title={`Trocar o apelido de ${p.name}`}
                          className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent transition-colors"
                        >
                          {p.name} <span className="text-foreground font-medium">· {p.nickname}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Reset em massa, com filtro por área e confirmação mostrando quem é afetado. */
function ResetNicknamesDialog({
  open, onOpenChange, people, onReset,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  people: NickPerson[];
  onReset: (ids: string[]) => Promise<number>;
}) {
  const [areaKey, setAreaKey] = useState<string>(TODAS_AS_AREAS);
  const [salvando, setSalvando] = useState(false);

  const opcoes = useMemo(() => {
    const base = [{ key: TODAS_AS_AREAS, label: "Todas as áreas", color: "#94A3B8" }];
    const grupos = groupPeopleByArea(
      people,
      AREAS.map(a => ({ key: a.key, label: getAreaLabel(a.key), color: a.color })),
    );
    return [...base, ...grupos.map(g => ({ key: g.key, label: g.label, color: g.color }))];
  }, [people]);

  const alvo = useMemo(() => peopleForReset(people, areaKey), [people, areaKey]);

  const confirmar = async () => {
    setSalvando(true);
    const n = await onReset(alvo.map(p => p.id));
    setSalvando(false);
    if (n > 0) toast.success(`${n} ${n === 1 ? "apelido apagado" : "apelidos apagados"}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!salvando) { setAreaKey(TODAS_AS_AREAS); onOpenChange(v); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resetar apelidos</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Área
            </label>
            <div className="flex flex-wrap gap-1.5">
              {opcoes.map(o => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setAreaKey(o.key)}
                  aria-pressed={areaKey === o.key}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    areaKey === o.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {alvo.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ninguém dessa seleção tem apelido para apagar.
            </p>
          ) : (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
              <div className="flex items-center gap-2 text-sm font-bold text-amber-500">
                <AlertTriangle className="h-4 w-4" />
                {alvo.length} {alvo.length === 1 ? "apelido será apagado" : "apelidos serão apagados"}
              </div>
              <p className="mt-1.5 text-xs text-foreground/80">
                {alvo.map(p => p.name).join(", ")}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Os pontos e o histórico não mudam — só o apelido volta a ficar vazio.
                Não dá para desfazer.
              </p>
            </div>
          )}
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            onClick={confirmar}
            disabled={alvo.length === 0 || salvando}
            className="bg-red-500 hover:bg-red-600 text-white font-bold"
          >
            {salvando ? "Apagando..." : `Apagar ${alvo.length > 0 ? alvo.length : ""}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Pontuação por demandas ───────────────────────────────────────────────────
// Define os valores rápidos que aparecem ao criar/editar uma demanda.
// Vale para o workspace inteiro; só diretores e owner podem alterar.
function DemandasTab() {
  const { points, savePoints, defaultPoints } = useDemandPoints();
  const [values, setValues] = useState<number[]>(points);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setValues(points); }, [points]);

  const dirty = values.length !== points.length || values.some((v, i) => v !== points[i]);

  const setAt = (i: number, raw: string) => {
    const n = Math.min(99, Math.max(1, Math.round(Number(raw) || 1)));
    setValues(prev => prev.map((v, idx) => (idx === i ? n : v)));
  };

  const save = async () => {
    setSaving(true);
    const res = await savePoints(values);
    setSaving(false);
    if (res.ok) toast.success("Pontuação das demandas atualizada!");
    else toast.error(res.error || "Não foi possível salvar.");
  };

  return (
    <div className="space-y-4 max-w-xl">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Pontuação por demandas</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Estes são os valores oferecidos ao criar uma demanda no Quadro CB e no calendário.
          A mudança vale para todo o workspace.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {values.map((v, i) => (
          <div key={i} className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground">Opção {i + 1}</label>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={1}
                max={99}
                value={v}
                onChange={e => setAt(i, e.target.value)}
                className="h-10 w-20 text-center font-bold"
                disabled={saving}
              />
              {values.length > 1 && (
                <button
                  type="button"
                  onClick={() => setValues(prev => prev.filter((_, idx) => idx !== i))}
                  title="Remover opção"
                  disabled={saving}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}

        {values.length < MAX_DEMAND_POINT_OPTIONS && (
          <Button
            type="button"
            variant="outline"
            className="h-10"
            disabled={saving}
            onClick={() => setValues(prev => [...prev, Math.min(99, (prev[prev.length - 1] ?? 0) + 1)])}
          >
            <Plus className="h-4 w-4 mr-1" /> Opção
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-3">
        <p className="text-[11px] font-medium text-muted-foreground mb-2">Prévia do seletor</p>
        <div className="flex flex-wrap gap-2">
          {values.map((v, i) => (
            <span
              key={i}
              className="px-4 h-9 rounded-full border border-primary/30 bg-primary/10 text-primary text-sm font-bold flex items-center"
            >
              {v} {v === 1 ? "ponto" : "pontos"}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button onClick={save} disabled={saving || !dirty}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
        {dirty && (
          <Button variant="ghost" onClick={() => setValues(points)} disabled={saving}>
            Cancelar
          </Button>
        )}
        <Button
          variant="ghost"
          className="ml-auto text-muted-foreground"
          onClick={() => setValues([...defaultPoints])}
          disabled={saving}
        >
          Restaurar padrão (1, 2, 3)
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Demandas já criadas mantêm os pontos que receberam.
      </p>
    </div>
  );
}
