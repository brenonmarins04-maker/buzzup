import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AREAS_DEFAULT } from "@/lib/areas";
import { useAreaNames } from "@/hooks/useAreaNames";
import { toast } from "sonner";

type Props = { open: boolean; onOpenChange: (o: boolean) => void };

export default function EditAreaNamesModal({ open, onOpenChange }: Props) {
  const { saveAreaNames, currentNames, areaNames } = useAreaNames();
  const [names, setNames] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const init: Record<string, string> = {};
    AREAS_DEFAULT.forEach(a => {
      init[a.key] = currentNames[a.key] || a.label;
    });
    setNames(init);
  }, [open, currentNames]);

  const save = async () => {
    setSaving(true);
    try {
      // Only store names that differ from the default
      const custom: Record<string, string> = {};
      AREAS_DEFAULT.forEach(a => {
        const val = (names[a.key] || "").trim();
        if (val && val !== a.label) custom[a.key] = val;
      });

      await saveAreaNames(custom);
      toast.success("Nomes das áreas atualizados!");
      onOpenChange(false);
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Nomes das Áreas</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {areaNames.map(area => (
            <div key={area.key} className="flex items-center gap-3">
              <div className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: area.color }} />
              <Input
                value={names[area.key] || ""}
                onChange={e => setNames(prev => ({ ...prev, [area.key]: e.target.value }))}
                placeholder={area.defaultLabel}
                className="h-9 flex-1"
                disabled={saving}
              />
            </div>
          ))}

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
