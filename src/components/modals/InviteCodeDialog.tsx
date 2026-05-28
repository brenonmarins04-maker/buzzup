import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

export default function InviteCodeDialog({
  open, onOpenChange, code, role,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  code: string;
  role: "admin" | "member";
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Código copiado.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Convite de {role === "admin" ? "Admin" : "Member"} gerado</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 rounded-md bg-muted border border-border">
            <code className="flex-1 text-lg font-mono font-semibold tracking-wider text-foreground select-all">{code}</code>
            <Button size="sm" variant="outline" onClick={copy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong className="text-foreground">Este código será exibido apenas uma vez.</strong> Copie e envie agora.</p>
            <p>Envie manualmente por WhatsApp, mensagem ou presencialmente. O sistema não envia e-mail automático.</p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
