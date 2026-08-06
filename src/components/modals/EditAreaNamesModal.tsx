import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAreaNames } from "@/hooks/useAreaNames";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

type Props = { open: boolean; onOpenChange: (o: boolean) => void };

export default function EditAreaNamesModal({ open, onOpenChange }: Props) {
  const { saveAreaNames, currentNames, areaNames } = useAreaNames();
  const [names, setNames] = useState<Record<string, string>>({});
  // Áreas criadas marcadas para exclusão ao salvar
  const [removed, setRemoved] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const init: Record<string, string> = {};
    areaNames.forEach(a => { init[a.key] = a.currentLabel; });
    setNames(init);
    setRemoved([]);
    // areaNames é derivado de currentNames; depender dele reabriria o efeito a cada render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentNames]);

  const save = async () => {
    setSaving(true);
    try {
      // Parte-se do mapa atual para não perder áreas criadas que não estão
      // listadas aqui (ex.: criadas em outra aba enquanto o modal estava aberto).
      const next: Record<string, string> = { ...currentNames };

      areaNames.forEach(a => {
        const val = (names[a.key] || "").trim();
        if (a.custom) {
          // Área criada: o nome é o que a define — sem nome, mantém o anterior
          if (val) next[a.key] = val;
        } else if (val && val !== a.defaultLabel) {
          next[a.key] = val;
        } else {
          delete next[a.key]; // voltou ao nome padrão
        }
      });

      removed.forEach(key => { delete next[key]; });

      await saveAreaNames(next);
      toast.success(removed.length ? "Áreas atualizadas!" : "Nomes das áreas atualizados!");
      onOpenChange(false);
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const visible = areaNames.filter(a => !removed.includes(a.key));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar áreas</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {visible.map(area => (
            <div key={area.key} className="flex items-center gap-3">
              <div className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: area.color }} />
              <Input
                value={names[area.key] ?? ""}
                onChange={e => setNames(prev => ({ ...prev, [area.key]: e.target.value }))}
                placeholder={area.defaultLabel}
                className="h-9 flex-1"
                disabled={saving}
              />
              {area.custom ? (
                <button
                  type="button"
                  onClick={() => setRemoved(prev => [...prev, area.key])}
                  disabled={saving}
                  title="Excluir área"
                  className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : (
                <span className="w-7 shrink-0" />
              )}
            </div>
          ))}

          {removed.length > 0 && (
            <p className="text-[11px] text-amber-600">
              {removed.length === 1 ? "1 área será excluída" : `${removed.length} áreas serão excluídas`} ao salvar.
              As demandas dela deixam de aparecer no menu.
            </p>
          )}

          <p className="text-[11px] text-muted-foreground">
            Os nomes alterados serão aplicados apenas neste workspace.
          </p>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
