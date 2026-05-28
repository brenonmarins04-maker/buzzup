import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Role = "admin" | "member";

export default function CreateInviteModal({
  open, onOpenChange, canInviteAdmin, onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  canInviteAdmin: boolean;
  onSubmit: (role: Role, expiresInHours: number, maxUses: number) => Promise<void>;
}) {
  const [role, setRole] = useState<Role>("member");
  const [expires, setExpires] = useState<1 | 24 | 168>(24);
  const [maxUses, setMaxUses] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setRole(canInviteAdmin ? "member" : "member");
      setExpires(24); setMaxUses(1); setSubmitting(false);
    }
  }, [open, canInviteAdmin]);

  const handle = async () => {
    setSubmitting(true);
    try {
      await onSubmit(role, expires, role === "admin" ? 1 : Math.max(1, Math.min(50, maxUses)));
    } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Gerar convite</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); handle(); }} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Cargo</label>
            <div className="grid grid-cols-2 gap-2">
              {canInviteAdmin && (
                <button type="button" onClick={() => setRole("admin")}
                  className={`px-3 py-2 rounded-md border text-sm font-medium ${role === "admin" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                  Admin
                </button>
              )}
              <button type="button" onClick={() => setRole("member")}
                className={`px-3 py-2 rounded-md border text-sm font-medium ${role === "member" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"} ${!canInviteAdmin ? "col-span-2" : ""}`}>
                Member
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Validade</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { v: 1 as const, label: "1 hora" },
                { v: 24 as const, label: "24 horas" },
                { v: 168 as const, label: "7 dias" },
              ].map(o => {
                const disabled = role === "admin" && o.v > 24;
                return (
                  <button key={o.v} type="button" disabled={disabled} onClick={() => setExpires(o.v)}
                    className={`px-2 py-2 rounded-md border text-xs font-medium ${expires === o.v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"} ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}>
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          {role === "member" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Quantidade de usos (1–50)</label>
              <Input type="number" min={1} max={50} value={maxUses}
                onChange={(e) => setMaxUses(parseInt(e.target.value) || 1)} />
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            O código será exibido apenas uma vez após a criação. Envie-o manualmente.
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={submitting}>{submitting ? "Gerando…" : "Gerar código"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
