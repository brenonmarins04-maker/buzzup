import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAreaNames } from "@/hooks/useAreaNames";
import { toast } from "sonner";

interface CreateAreaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateAreaModal({ open, onOpenChange }: CreateAreaModalProps) {
  const { addArea } = useAreaNames();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const label = name.trim();
    if (!label || busy) return;
    setBusy(true);
    const created = await addArea(label);
    setBusy(false);
    if (!created) {
      toast.error("Não foi possível criar a área. Só o owner pode criar áreas.");
      return;
    }
    toast.success(`Área "${label}" criada!`);
    onOpenChange(false);
    navigate(created.path);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nova área</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nome da área</label>
            <Input
              ref={inputRef}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex.: Comercial"
              maxLength={40}
            />
            <p className="text-[11px] text-muted-foreground mt-1.5">
              A área ganha o próprio quadro de demandas, presenças e links úteis.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={!name.trim() || busy}>
              {busy ? "Criando..." : "Criar área"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
