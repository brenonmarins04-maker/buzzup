import { useEffect, useState } from "react";
import { Clock, Pencil } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Props = {
  /** Apelido já aprovado, que aparece no ranking */
  nickname: string | null | undefined;
  /** Apelido enviado e ainda esperando um diretor */
  pending: string | null | undefined;
};

export default function NicknamePicker({ nickname, pending }: Props) {
  const { setMyNickname } = useData();
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);

  const aprovado = nickname?.trim() || "";
  const proposto = pending?.trim() || "";

  useEffect(() => {
    if (open) setTexto(proposto || aprovado);
  }, [open, proposto, aprovado]);

  const enviar = async () => {
    setSalvando(true);
    await setMyNickname(texto);
    setSalvando(false);
    setOpen(false);
  };

  // Três estados: esperando aprovação, já aprovado, ou nada escolhido
  const rotulo = proposto
    ? proposto
    : aprovado || "Escolher apelido";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            proposto ? `Apelido "${proposto}" aguardando aprovação. Toque para trocar`
              : aprovado ? `Seu apelido: ${aprovado}. Toque para trocar`
                : "Você ainda não escolheu um apelido. Toque para escolher"
          }
          /* Sem apelido o aviso é vermelho: é a única pista de que falta algo,
             e a pessoa passa poucos segundos na tela */
          className={`inline-flex max-w-full items-center gap-1 rounded-lg px-1.5 py-0.5 text-xs font-semibold transition-colors ${
            aprovado && !proposto
              ? "text-muted-foreground hover:bg-accent"
              : proposto
                ? "bg-amber-500/15 text-amber-700 hover:bg-amber-500/25"
                : "bg-red-500/15 text-red-600 hover:bg-red-500/25"
          }`}
        >
          {!aprovado && !proposto && <span aria-hidden="true">⚠️</span>}
          {proposto && <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />}
          <span className="truncate">{rotulo}</span>
          {aprovado && !proposto && <Pencil className="h-2.5 w-2.5 shrink-0 opacity-60" aria-hidden="true" />}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-72 p-3" align="start">
        <p className="text-xs font-semibold text-foreground">Seu apelido no ranking</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Um diretor precisa aprovar antes de ele aparecer para todo mundo.
        </p>

        {proposto && (
          <p className="mt-2 rounded-lg bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-700">
            "{proposto}" está esperando aprovação
            {aprovado && <> — por enquanto vale "{aprovado}"</>}.
          </p>
        )}

        <Input
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void enviar(); } }}
          placeholder="Ex.: Pavê"
          maxLength={40}
          className="mt-2"
          autoFocus
        />

        <div className="mt-2 flex items-center gap-2">
          {proposto && (
            <Button
              variant="ghost"
              size="sm"
              disabled={salvando}
              onClick={() => { setTexto(""); void setMyNickname(null).then(() => setOpen(false)); }}
              className="text-xs text-muted-foreground"
            >
              Cancelar pedido
            </Button>
          )}
          <Button
            size="sm"
            disabled={salvando || !texto.trim()}
            onClick={enviar}
            className="ml-auto"
          >
            Enviar para aprovação
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
