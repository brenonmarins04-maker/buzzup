import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useData } from "@/contexts/DataContext";
import type { ParkingItem } from "@/contexts/DataContext";
import { AREAS, getTeamColor } from "@/lib/areas";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";

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
  const { people, teams, addParkingItem, updateParkingItem, deleteParkingItem } = useData();
  const [title, setTitle] = useState("");
  const [area, setArea] = useState("");
  const [personId, setPersonId] = useState<string>("");
  const [date, setDate] = useState("");
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

  // Check if selected area is a team
  const isTeamArea = area.startsWith("team_");
  const selectedTeam = isTeamArea ? teams.find(t => `team_${t.id}` === area) : null;

  const peopleForArea = useMemo(() => {
    if (!area) return [];
    if (isTeamArea && selectedTeam) {
      return people.filter(p => selectedTeam.memberIds.includes(p.id));
    }
    return people.filter(p => (p.areas && p.areas.includes(area)) || (p.area && p.area.includes(area)));
  }, [people, area, isTeamArea, selectedTeam]);

  const handleClose = (next: boolean) => {
    if (!next && !savedOk && onCancel) onCancel();
    onOpenChange(next);
  };

  const handleSave = async () => {
    const t = title.trim();
    if (!t) { toast.error("Título é obrigatório"); return; }
    if (!area) { toast.error("Selecione a área primeiro"); return; }
    if (![1, 2, 3].includes(points)) { toast.error("Selecione os pontos (1, 2 ou 3)"); return; }
    if (requireFull) {
      if (!date) { toast.error("Selecione uma data"); return; }
    }
    if (item) {
      await updateParkingItem({ ...item, title: t, area, personId: personId || null, date, points });
      toast.success("Ideia atualizada");
    } else {
      await addParkingItem(area, t, date, "", points);
    }
    setSavedOk(true);
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!item) return;
    await deleteParkingItem(item.id);
    toast.success("Ideia excluída");
    setSavedOk(true);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent
          className="max-w-md overflow-hidden shadow-2xl bg-background"
          style={{
            background: area
              ? (() => {
                  const c = area.startsWith("team_") ? getTeamColor(area.slice(5)) : (AREAS.find(a => a.key === area)?.color || "#64748B");
                  return `linear-gradient(160deg, color-mix(in srgb, ${c} 35%, white) 0%, color-mix(in srgb, ${c} 15%, white) 45%, white 100%)`;
                })()
              : undefined,
          }}
        >
          <div
            className="absolute top-0 left-0 right-0 h-1.5 transition-colors"
            style={{ background: area ? (area.startsWith("team_") ? getTeamColor(area.slice(5)) : (AREAS.find(a => a.key === area)?.color || "#64748B")) : "hsl(var(--muted))" }}
          />
          <DialogHeader>
            <DialogTitle className="text-lg">{item ? "Editar ideia" : "Nova ideia"}</DialogTitle>
            {requireFull && (
              <DialogDescription className="text-xs">
                Para colocar no calendário, preencha área, responsável e data.
              </DialogDescription>
            )}
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="flex flex-col gap-4">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Título</label>
              <Input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Descreva a ideia" className="rounded-full h-11 px-4" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Área <span className="text-destructive">*</span></label>
              <div className="flex gap-3 items-start">
                {/* Áreas */}
                <div className="flex flex-col gap-1.5 shrink-0">
                  <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide">Áreas</span>
                  <div className="flex flex-wrap gap-1.5">
                    {AREAS.map(a => {
                      const selected = area === a.key;
                      return (
                        <button
                          key={a.key}
                          type="button"
                          onClick={() => { setArea(a.key); setPersonId(""); }}
                          className="px-3 h-8 rounded-full text-xs font-medium transition-all border"
                          style={{
                            backgroundColor: selected ? a.color : `${a.color}14`,
                            color: selected ? "#fff" : a.color,
                            borderColor: selected ? a.color : `${a.color}40`,
                            boxShadow: selected ? `0 4px 14px ${a.color}55` : "none",
                            transform: selected ? "translateY(-1px)" : "none",
                          }}
                        >
                          {a.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Divisor */}
                {teams.length > 0 && <div className="w-px bg-border/60 self-stretch mt-5 shrink-0" />}
                {/* Times */}
                {teams.length > 0 && (
                  <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                    <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide">Times</span>
                    <div className="flex flex-wrap gap-1.5">
                      {teams.map(t => {
                        const teamKey = `team_${t.id}`;
                        const selected = area === teamKey;
                        const tc = getTeamColor(t.id);
                        return (
                          <button
                            key={teamKey}
                            type="button"
                            onClick={() => { setArea(teamKey); setPersonId(""); }}
                            className="px-3 h-8 rounded-full text-xs font-medium transition-all border"
                            style={{
                              backgroundColor: selected ? tc : `${tc}14`,
                              color: selected ? "#fff" : tc,
                              borderColor: selected ? tc : `${tc}40`,
                              boxShadow: selected ? `0 4px 14px ${tc}55` : "none",
                              transform: selected ? "translateY(-1px)" : "none",
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
            <div>
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Responsável {requireFull && <span className="text-destructive">*</span>}</label>
              {!area ? (
                <div className="h-11 rounded-full border border-dashed border-input bg-muted/30 px-4 flex items-center text-sm text-muted-foreground">
                  Selecione a área primeiro
                </div>
              ) : peopleForArea.length === 0 ? (
                <div className="h-11 rounded-full border border-input bg-muted/30 px-4 flex items-center text-2xl">😞</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {peopleForArea.map(p => {
                    const selected = personId === p.id;
                    const areaColor = AREAS.find(a => a.key === area)?.color || "#64748B";
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPersonId(p.id)}
                        className="px-4 h-9 rounded-full text-sm font-medium transition-all border"
                        style={{
                          backgroundColor: selected ? areaColor : `${areaColor}10`,
                          color: selected ? "#fff" : "hsl(var(--foreground))",
                          borderColor: selected ? areaColor : `${areaColor}30`,
                          boxShadow: selected ? `0 4px 14px ${areaColor}55` : "none",
                        }}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Data {requireFull && <span className="text-destructive">*</span>}</label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded-full h-11 px-4" />
              {!requireFull && <p className="text-[10px] text-muted-foreground mt-1">Deixe em branco para manter em Papel.</p>}
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Pontos <span className="text-destructive">*</span>
              </label>
              <div className="flex gap-2">
                {[1, 2, 3].map(n => {
                  const selected = points === n;
                  const areaColor = AREAS.find(a => a.key === area)?.color || "#64748B";
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPoints(n)}
                      className="flex-1 h-12 rounded-full text-base font-bold transition-all border"
                      style={{
                        backgroundColor: selected ? areaColor : `${areaColor}10`,
                        color: selected ? "#fff" : areaColor,
                        borderColor: selected ? areaColor : `${areaColor}30`,
                        boxShadow: selected ? `0 4px 14px ${areaColor}55` : "none",
                        transform: selected ? "translateY(-1px)" : "none",
                      }}
                    >
                      {n} {n === 1 ? "ponto" : "pontos"}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Somados na gamificação quando a demanda for concluída.</p>
            </div>
            <div className="flex items-center justify-between pt-2">
              {item ? (
                <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive rounded-full" onClick={() => setConfirmDel(true)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                </Button>
              ) : <div />}
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="rounded-full px-5" onClick={() => handleClose(false)}>Cancelar</Button>
                <Button
                  type="submit"
                  className="rounded-full px-5 text-white border-0 hover:opacity-90"
                  style={area ? { backgroundColor: AREAS.find(a => a.key === area)?.color } : undefined}
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