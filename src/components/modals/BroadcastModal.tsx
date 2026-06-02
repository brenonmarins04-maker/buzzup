import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useData } from "@/contexts/DataContext";
import { toast } from "sonner";

const MAX_HOURS = 72;

export default function BroadcastModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { addBroadcast } = useData();
  const [message, setMessage] = useState("");
  const [hours, setHours] = useState("24");
  const [minutes, setMinutes] = useState("0");
  const [saving, setSaving] = useState(false);

  const totalMinutes = (() => {
    const h = Math.max(0, parseInt(hours, 10) || 0);
    const m = Math.max(0, Math.min(59, parseInt(minutes, 10) || 0));
    return h * 60 + m;
  })();

  const totalMinutesClamped = Math.min(MAX_HOURS * 60, totalMinutes);
  const overMax = totalMinutes > MAX_HOURS * 60;

  const formatDuration = () => {
    const h = Math.floor(totalMinutesClamped / 60);
    const m = totalMinutesClamped % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
  };

  const handleSave = async () => {
    const trimmed = message.trim();
    if (!trimmed) { toast.error("Digite a mensagem"); return; }
    if (totalMinutesClamped < 1) { toast.error("Duração mínima de 1 minuto"); return; }
    if (trimmed.length > 500) { toast.error("Mensagem muito longa (máx 500)"); return; }
    setSaving(true);
    // Convert minutes to fractional days
    const durationDays = totalMinutesClamped / (24 * 60);
    await addBroadcast(trimmed, durationDays);
    setSaving(false);
    setMessage(""); setHours("24"); setMinutes("0");
    onOpenChange(false);
    toast.success(`Mensagem publicada por ${formatDuration()}`);
  };

  // Quick preset buttons
  const presets = [
    { label: "30min", h: 0, m: 30 },
    { label: "1h", h: 1, m: 0 },
    { label: "4h", h: 4, m: 0 },
    { label: "12h", h: 12, m: 0 },
    { label: "24h", h: 24, m: 0 },
    { label: "48h", h: 48, m: 0 },
    { label: "72h", h: 72, m: 0 },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova mensagem geral</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bc-msg">Texto da mensagem</Label>
            <Textarea
              id="bc-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ex: Reunião geral às 19h!"
              rows={4}
              maxLength={500}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Duração da exibição (máx 72h)</Label>

            {/* Quick presets */}
            <div className="flex flex-wrap gap-1.5">
              {presets.map(p => {
                const active = parseInt(hours, 10) === p.h && parseInt(minutes, 10) === p.m;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => { setHours(String(p.h)); setMinutes(String(p.m)); }}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      active
                        ? "bg-red-500 text-white border-red-500"
                        : "bg-background border-input text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <div className="flex-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1 block">
                  Horas
                </label>
                <Input
                  type="number"
                  min={0}
                  max={MAX_HOURS}
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1 block">
                  Minutos
                </label>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            <p className={`text-[11px] ${overMax ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
              {overMax
                ? `Limitado ao máximo de 72h (ajustado para 72h)`
                : `Será exibida por ${formatDuration()}`}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>Publicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
