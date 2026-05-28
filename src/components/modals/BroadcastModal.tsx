import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useData } from "@/contexts/DataContext";
import { toast } from "sonner";

export default function BroadcastModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { addBroadcast } = useData();
  const [message, setMessage] = useState("");
  const [days, setDays] = useState("7");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = message.trim();
    const d = parseInt(days, 10);
    if (!trimmed) { toast.error("Digite a mensagem"); return; }
    if (!d || d < 1) { toast.error("Duração inválida"); return; }
    if (trimmed.length > 500) { toast.error("Mensagem muito longa (máx 500)"); return; }
    setSaving(true);
    await addBroadcast(trimmed, d);
    setSaving(false);
    setMessage(""); setDays("7");
    onOpenChange(false);
    toast.success("Mensagem publicada");
  };

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
              placeholder="Ex: Reunião geral amanhã às 19h!"
              rows={4}
              maxLength={500}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bc-days">Duração da exibição (dias)</Label>
            <Input
              id="bc-days"
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
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