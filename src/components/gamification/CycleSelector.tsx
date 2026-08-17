import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatCycleRange } from "@/lib/gamificationCycles";
import type { useGamificationCycles } from "@/hooks/useGamificationCycles";

type Cycles = ReturnType<typeof useGamificationCycles>;

/**
 * Filtro de ciclos da gamificação. Todos veem o ciclo ativo (ele vale para o
 * workspace inteiro); só diretores trocam de ciclo, criam e excluem.
 */
export default function CycleSelector({ cycles }: { cycles: Cycles }) {
  const { cycles: list, activeId, activeCycle, canManage, addCycle, removeCycle, setActiveCycle } = cycles;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [start, setStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);

  // Sem ciclos e sem permissão de criar: nada a mostrar
  if (list.length === 0 && !canManage) return null;

  const openCreate = () => {
    setName(`Ciclo ${list.length + 1}`);
    setStart(new Date().toISOString().slice(0, 10));
    setEnd("");
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!start) { toast.error("Escolha a data de início do ciclo"); return; }
    if (end && end < start) { toast.error("A data final não pode ser antes do início"); return; }
    setBusy(true);
    const res = await addCycle(name, start, end);
    setBusy(false);
    if (!res.ok) { toast.error(res.error || "Não foi possível criar o ciclo."); return; }
    toast.success(`Ciclo "${name.trim() || "Ciclo"}" criado e ativado!`);
    setOpen(false);
  };

  const pick = async (id: string | null) => {
    if (!canManage) return;
    const res = await setActiveCycle(id);
    if (!res.ok) toast.error(res.error || "Não foi possível trocar o ciclo.");
  };

  const drop = async (id: string, cycleName: string) => {
    const res = await removeCycle(id);
    if (res.ok) toast.success(`Ciclo "${cycleName}" excluído.`);
    else toast.error(res.error || "Não foi possível excluir o ciclo.");
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-3">
      {canManage ? (
        <>
          <button
            type="button"
            onClick={() => pick(null)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
              !activeId
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
            }`}
          >
            Desde o início
          </button>

          {list.map(c => {
            const active = c.id === activeId;
            return (
              <span
                key={c.id}
                className={`group inline-flex items-center rounded-full border transition-colors ${
                  active ? "bg-primary text-primary-foreground border-primary" : "border-border"
                }`}
              >
                <button
                  type="button"
                  onClick={() => pick(c.id)}
                  title={formatCycleRange(c)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-l-full ${
                    active ? "" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c.name}
                </button>
                <button
                  type="button"
                  onClick={() => drop(c.id, c.name)}
                  title="Excluir ciclo"
                  className={`pr-2 pl-0.5 py-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                    active ? "text-primary-foreground/80 hover:text-white" : "text-muted-foreground hover:text-destructive"
                  }`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>
            );
          })}

          <button
            type="button"
            onClick={openCreate}
            title="Criar ciclo"
            className="h-6 w-6 rounded-full border border-dashed border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </>
      ) : (
        // Quem não é diretor apenas enxerga qual ciclo está valendo
        activeCycle && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold">
            {activeCycle.name}
            <span className="font-normal text-primary/70">· {formatCycleRange(activeCycle)}</span>
          </span>
        )
      )}

      {canManage && activeCycle && (
        <span className="text-[10px] text-muted-foreground ml-1">{formatCycleRange(activeCycle)}</span>
      )}

      <Dialog open={open} onOpenChange={(o) => { if (!busy) setOpen(o); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Novo ciclo</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nome</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ciclo 1" maxLength={40} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Início</label>
                <Input type="date" value={start} onChange={e => setStart(e.target.value)} required />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Fim (opcional)</label>
                <Input type="date" value={end} min={start} onChange={e => setEnd(e.target.value)} />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              O ranking passa a contar só os pontos ganhos dentro deste período — pontos
              anteriores não entram. Sem data final, o ciclo segue em andamento.
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancelar</Button>
              <Button type="submit" disabled={busy || !start}>{busy ? "Criando..." : "Criar ciclo"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
