import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useData } from "@/contexts/DataContext";
import type { ParkingItem } from "@/contexts/DataContext";
import { AREAS, getAreaColor, getTeamColor, getTeamIdFromAreaKey } from "@/lib/areas";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import { useDemandPoints } from "@/hooks/useDemandPoints";
import { contarDemandasAbertas, recomendarMenosCarregados } from "@/lib/cargaDeDemandas";
import { Sparkles } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: ParkingItem | null;
  defaultArea?: string;
  defaultDate?: string;
  /** When true, area + person are required to save (used when dropping onto a calendar date). */
  requireFull?: boolean;
  /** Called when the modal closes without successful save (e.g. cancel during drop-complete). */
  onCancel?: () => void;
};

export default function IdeaModal({ open, onOpenChange, item, defaultArea, defaultDate, requireFull, onCancel }: Props) {
  const { people, teams, tasks, parkingItems, addParkingItem, updateParkingItem, deleteParkingItem } = useData();
  const [title, setTitle] = useState("");
  const [area, setArea] = useState("");
  const [personId, setPersonId] = useState<string>("");
  const [date, setDate] = useState("");
  const { points: demandPoints } = useDemandPoints();
  const [points, setPoints] = useState<number>(1);
  const [savedOk, setSavedOk] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSavedOk(false);
    setTitle(item?.title ?? "");
    setArea(item?.area || defaultArea || "");
    setPersonId(item?.personId || "");
    setDate(item?.date || defaultDate || "");
    setPoints(item?.points ?? 1);
  }, [open, item, defaultArea, defaultDate]);

  // Check if selected area is a team. Existing items may use TEAM_ or team_.
  const teamId = getTeamIdFromAreaKey(area);
  const isTeamArea = !!teamId;
  const selectedTeam = isTeamArea ? teams.find(t => t.id === teamId || t.id.toLowerCase() === teamId!.toLowerCase()) : null;
  const selectedColor = area ? getAreaColor(selectedTeam ? `team_${selectedTeam.id}` : area) : "#64748B";

  const peopleForArea = useMemo(() => {
    if (!area) return [];
    if (isTeamArea && selectedTeam) {
      return people.filter(p => selectedTeam.memberIds.includes(p.id));
    }
    return people.filter(p => (p.areas && p.areas.includes(area)) || (p.area && p.area.includes(area)));
  }, [people, area, isTeamArea, selectedTeam]);

  /**
   * Quantas demandas em aberto cada pessoa já tem — no workspace inteiro.
   *
   * De propósito sobre todas as áreas e times, não só sobre a área desta
   * demanda: quem está com três no time de Diversidade e nenhuma no Mercado
   * não está livre, e olhar só para o Mercado diria que está.
   */
  const cargaPorPessoa = useMemo(
    () => contarDemandasAbertas(parkingItems, tasks),
    [parkingItems, tasks],
  );
  const recomendados = useMemo(
    () => recomendarMenosCarregados(peopleForArea, cargaPorPessoa),
    [peopleForArea, cargaPorPessoa],
  );

  const handleClose = (next: boolean) => {
    if (!next && !savedOk && onCancel) onCancel();
    onOpenChange(next);
  };

  const handleSave = async () => {
    const t = title.trim();
    if (!t) { toast.error("Título é obrigatório"); return; }
    if (!area) { toast.error("Selecione a área primeiro"); return; }
    if (!demandPoints.includes(points)) { toast.error("Selecione os pontos"); return; }
    if (requireFull) {
      if (!date) { toast.error("Selecione uma data"); return; }
    }
    if (item) {
      await updateParkingItem({ ...item, title: t, area, personId: personId || null, date, points });
      toast.success("Demanda atualizada");
    } else {
      await addParkingItem(area, t, date, "", points);
    }
    setSavedOk(true);
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!item) return;
    await deleteParkingItem(item.id);
    toast.success("Demanda excluída");
    setSavedOk(true);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent
          className="max-w-2xl shadow-2xl bg-background"
          style={{
            background: area
              ? (() => {
                  const c = selectedColor;
                  return `linear-gradient(160deg, color-mix(in srgb, ${c} 30%, white) 0%, color-mix(in srgb, ${c} 12%, white) 50%, white 100%)`;
                })()
              : undefined,
          }}
        >
          <div
            className="absolute top-0 left-0 right-0 h-1.5 transition-colors"
            style={{ background: area ? selectedColor : "hsl(var(--muted))" }}
          />
          <DialogHeader>
            <DialogTitle className="text-base">{item ? "Editar demanda" : "Nova demanda"}</DialogTitle>
            {requireFull && (
              <DialogDescription className="text-xs">
                Para colocar no calendário, preencha área, responsável e data.
              </DialogDescription>
            )}
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="flex flex-col gap-3">
            {/* Título — largura total */}
            <div>
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Título</label>
              <Input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Descreva a demanda" className="rounded-full h-9 px-4 text-sm" />
            </div>

            {/* Linha principal: Área (esq) | Responsável + Data + Pontos (dir) */}
            <div className="grid grid-cols-2 gap-4 items-start">

              {/* Esquerda: Área */}
              <div>
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Área <span className="text-destructive">*</span></label>
                <div className={`grid gap-x-2 ${teams.length > 0 ? "grid-cols-2" : "grid-cols-1"}`}>
                  {/* Áreas */}
                  <div className="flex flex-col gap-1">
                    {teams.length > 0 && <span className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wide mb-0.5">Áreas</span>}
                    {AREAS.map(a => {
                      const selected = area === a.key;
                      return (
                        <button key={a.key} type="button" onClick={() => { setArea(a.key); setPersonId(""); }}
                          className="w-full px-2 py-1 rounded-full text-xs font-medium transition-all border text-left leading-tight"
                          style={{
                            backgroundColor: selected ? a.color : `${a.color}14`,
                            color: selected ? "#fff" : a.color,
                            borderColor: selected ? a.color : `${a.color}40`,
                            boxShadow: selected ? `0 2px 8px ${a.color}55` : "none",
                          }}
                        >
                          {a.label}
                        </button>
                      );
                    })}
                  </div>
                  {/* Times */}
                  {teams.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wide mb-0.5">Times</span>
                      <div className="flex flex-col gap-1 max-h-[180px] overflow-y-auto pr-0.5">
                        {teams.map(t => {
                          const teamKey = `team_${t.id}`;
                          const selected = area === teamKey;
                          const tc = getTeamColor(t.id);
                          return (
                            <button key={teamKey} type="button" onClick={() => { setArea(teamKey); setPersonId(""); }}
                              className="w-full px-2 py-1 rounded-full text-xs font-medium transition-all border text-left leading-tight"
                              style={{
                                backgroundColor: selected ? tc : `${tc}14`,
                                color: selected ? "#fff" : tc,
                                borderColor: selected ? tc : `${tc}40`,
                                boxShadow: selected ? `0 2px 8px ${tc}55` : "none",
                              }}
                            >
                              {t.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Direita: Responsável + Data + Pontos */}
              <div className="flex flex-col gap-3">
                {/* Responsável */}
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1 block">
                    Responsável {requireFull && <span className="text-destructive">*</span>}
                  </label>
                  {recomendados.size > 0 && (
                    <p className="text-[10px] leading-snug text-muted-foreground mb-1.5">
                      O número é quantas demandas a pessoa já tem em aberto, somando
                      todas as áreas e times.
                    </p>
                  )}
                  {!area ? (
                    <div className="h-8 rounded-full border border-dashed border-input bg-muted/30 px-3 flex items-center text-xs text-muted-foreground">
                      Selecione a área primeiro
                    </div>
                  ) : peopleForArea.length === 0 ? (
                    <div className="h-8 rounded-full border border-input bg-muted/30 px-3 flex items-center">😞</div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-h-[150px] overflow-y-auto pt-0.5">
                      {peopleForArea.map(p => {
                        const selected = personId === p.id;
                        const areaColor = selectedColor;
                        const abertas = cargaPorPessoa.get(p.id) ?? 0;
                        const recomendado = recomendados.has(p.id);
                        return (
                          <button key={p.id} type="button" onClick={() => setPersonId(p.id)}
                            title={`${p.name} — ${abertas} ${abertas === 1 ? "demanda em aberto" : "demandas em aberto"} no total${recomendado ? " (é quem tem menos)" : ""}`}
                            className={`flex items-center gap-1.5 px-2.5 h-7 rounded-full text-xs font-medium transition-all border ${recomendado ? "ring-2 ring-emerald-500 ring-offset-1 ring-offset-background" : ""}`}
                            style={{
                              backgroundColor: selected ? areaColor : `${areaColor}10`,
                              color: selected ? "#fff" : "hsl(var(--foreground))",
                              borderColor: selected ? areaColor : `${areaColor}30`,
                              boxShadow: selected ? `0 2px 8px ${areaColor}55` : "none",
                            }}
                          >
                            <span>{p.name}</span>
                            <span
                              className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums"
                              style={{
                                backgroundColor: selected ? "rgba(255,255,255,0.28)" : `${areaColor}22`,
                                color: selected ? "#fff" : areaColor,
                              }}
                            >
                              {abertas}
                            </span>
                            {recomendado && (
                              <span className="flex items-center gap-0.5 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                                <Sparkles className="h-2.5 w-2.5" />
                                recomendado
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Data */}
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1 block">
                    Data {requireFull && <span className="text-destructive">*</span>}
                  </label>
                  <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded-full h-9 px-4 text-sm" />
                  {!requireFull && <p className="text-[10px] text-muted-foreground mt-0.5">Deixe em branco para manter em Papel.</p>}
                </div>

                {/* Pontos */}
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1 block">
                    Pontos <span className="text-destructive">*</span>
                  </label>
                  <div className="flex gap-1.5">
                    {demandPoints.map(n => {
                      const selected = points === n;
                      const areaColor = selectedColor;
                      return (
                        <button key={n} type="button" onClick={() => setPoints(n)}
                          className="flex-1 h-9 rounded-full text-sm font-bold transition-all border"
                          style={{
                            backgroundColor: selected ? areaColor : `${areaColor}10`,
                            color: selected ? "#fff" : areaColor,
                            borderColor: selected ? areaColor : `${areaColor}30`,
                            boxShadow: selected ? `0 2px 8px ${areaColor}55` : "none",
                            transform: selected ? "translateY(-1px)" : "none",
                          }}
                        >
                          {n}pt
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Botões */}
            <div className="flex items-center justify-between pt-1">
              {item ? (
                <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive rounded-full" onClick={() => setConfirmDel(true)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                </Button>
              ) : <div />}
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="rounded-full px-4 h-9" onClick={() => handleClose(false)}>Cancelar</Button>
                <Button type="submit" className="rounded-full px-4 h-9 text-white border-0 hover:opacity-90"
                  style={area ? { backgroundColor: selectedColor } : undefined}
                >
                  {requireFull ? "Colocar no calendário" : "Salvar"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {item && (
        <DeleteConfirmDialog
          open={confirmDel}
          onOpenChange={setConfirmDel}
          title={item.title}
          onConfirm={handleDelete}
        />
      )}
    </>
  );
}
