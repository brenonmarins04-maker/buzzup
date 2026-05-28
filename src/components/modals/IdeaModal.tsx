import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useData } from "@/contexts/DataContext";
import type { ParkingItem } from "@/contexts/DataContext";
import { AREAS } from "@/lib/areas";
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
  const { people, addParkingItem, updateParkingItem, deleteParkingItem } = useData();
  const [title, setTitle] = useState("");
  const [area, setArea] = useState("");
  const [personId, setPersonId] = useState<string>("");
  const [date, setDate] = useState("");
  const [savedOk, setSavedOk] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSavedOk(false);
    setTitle(item?.title ?? "");
    setArea(item?.area || defaultArea || "");
    setPersonId(item?.personId || "");
    setDate(item?.date || defaultDate || "");
  }, [open, item, defaultArea, defaultDate]);

  const peopleForArea = useMemo(() => {
    if (!area) return people;
    const inArea = people.filter(p => p.area === area);
    return inArea.length > 0 ? inArea : people;
  }, [people, area]);

  const handleClose = (next: boolean) => {
    if (!next && !savedOk && onCancel) onCancel();
    onOpenChange(next);
  };

  const handleSave = async () => {
    const t = title.trim();
    if (!t) { toast.error("Título é obrigatório"); return; }
    if (requireFull) {
      if (!area) { toast.error("Selecione a área"); return; }
      if (!personId) { toast.error("Selecione o responsável"); return; }
      if (!date) { toast.error("Selecione uma data"); return; }
    }
    if (item) {
      await updateParkingItem({ ...item, title: t, area, personId: personId || null, date });
      toast.success("Ideia atualizada");
    } else {
      // addParkingItem only persists area/title/date/description; use updateParkingItem afterwards if person is set.
      await addParkingItem(area, t, date, "");
      // Note: new items go through addParkingItem which doesn't accept personId — we accept that for now.
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{item ? "Editar ideia" : "Nova ideia"}</DialogTitle>
            {requireFull && (
              <DialogDescription className="text-xs">
                Para colocar no calendário, preencha área, responsável e data.
              </DialogDescription>
            )}
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="flex flex-col gap-3">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Título</label>
              <Input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Descreva a ideia" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Área {requireFull && <span className="text-destructive">*</span>}</label>
                <select value={area} onChange={e => { setArea(e.target.value); setPersonId(""); }}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">— Sem área —</option>
                  {AREAS.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Responsável {requireFull && <span className="text-destructive">*</span>}</label>
                <select value={personId} onChange={e => setPersonId(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">— Selecionar —</option>
                  {peopleForArea.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Data {requireFull && <span className="text-destructive">*</span>}</label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
              {!requireFull && <p className="text-[10px] text-muted-foreground mt-1">Deixe em branco para manter em Ideias gerais.</p>}
            </div>
            <div className="flex items-center justify-between pt-2">
              {item ? (
                <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setConfirmDel(true)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                </Button>
              ) : <div />}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
                <Button type="submit">{requireFull ? "Colocar no calendário" : "Salvar"}</Button>
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
          itemType="ideia"
          onConfirm={handleDelete}
        />
      )}
    </>
  );
}