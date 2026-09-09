import { useState } from "react";
import { useData } from "@/contexts/DataContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EMOJI_OPTIONS } from "@/lib/gamificationEmoji";

export default function EmojiPicker({ atual }: { atual: string | null | undefined }) {
  const { setMyEmoji } = useData();
  const [open, setOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const escolher = async (emoji: string | null) => {
    setSalvando(true);
    await setMyEmoji(emoji);
    setSalvando(false);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={atual
            ? `Seu emoji: ${atual}. Toque para trocar`
            : "Você ainda não escolheu seu emoji do ranking. Toque para escolher"}
          title={atual ? "Seu emoji no ranking" : "Escolha seu emoji do ranking"}
          /* Sem emoji o botão fica vermelho e pulsando: é fácil não reparar
             num ícone neutro, e a pessoa passa poucos segundos na tela */
          className={`h-14 w-14 shrink-0 rounded-xl border text-2xl flex items-center justify-center transition-colors md:h-10 md:w-10 md:text-xl ${
            atual
              ? "border-border bg-card hover:bg-accent"
              : "animate-pulse border-red-500 bg-red-500/15 hover:bg-red-500/25"
          }`}
        >
          {atual || "⚠️"}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-64 p-3" align="end">
        <p className="text-xs font-semibold text-foreground">Seu emoji no ranking</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Todo mundo do workspace vê ele ao lado do seu nome.
        </p>

        <div className="mt-2 grid grid-cols-8 gap-1">
          {EMOJI_OPTIONS.map(e => (
            <button
              key={e}
              type="button"
              disabled={salvando}
              onClick={() => escolher(e)}
              aria-label={e}
              aria-pressed={atual === e}
              className={`h-7 w-7 rounded-lg text-lg leading-none transition-colors disabled:opacity-50 ${
                atual === e ? "bg-primary/20 ring-1 ring-primary" : "hover:bg-accent"
              }`}
            >
              {e}
            </button>
          ))}
        </div>

        {atual && (
          <button
            type="button"
            disabled={salvando}
            onClick={() => escolher(null)}
            className="mt-2 w-full rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            Remover emoji
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
