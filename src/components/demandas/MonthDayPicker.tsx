import { useMemo, useState } from "react";
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEK_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/**
 * Calendário do mês para escolher um dia.
 *
 * Cada dia tem borda visível e fundo próprio — sem isso não fica claro que a
 * grade é clicável, e a pessoa fica olhando sem saber o que fazer.
 */
export default function MonthDayPicker({
  value, onChange,
}: {
  /** "YYYY-MM-DD" ou "" quando não há data */
  value: string;
  onChange: (iso: string) => void;
}) {
  const hoje = new Date();
  const [mes, setMes] = useState(() => {
    if (!value) return startOfMonth(hoje);
    const [y, m] = value.split("-").map(Number);
    return y && m ? new Date(y, m - 1, 1) : startOfMonth(hoje);
  });

  const dias = useMemo(() => eachDayOfInterval({
    start: startOfWeek(startOfMonth(mes)),
    end: endOfWeek(endOfMonth(mes)),
  }), [mes]);

  const selecionado = value
    ? (() => { const [y, m, d] = value.split("-").map(Number); return new Date(y, m - 1, d); })()
    : null;

  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMes(m => subMonths(m, 1))}
          aria-label="Mês anterior"
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-bold capitalize text-foreground">
          {format(mes, "MMMM 'de' yyyy", { locale: ptBR })}
        </span>
        <button
          type="button"
          onClick={() => setMes(m => addMonths(m, 1))}
          aria-label="Próximo mês"
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEK_DAYS.map(d => (
          <div key={d} className="pb-1 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {d[0]}
          </div>
        ))}

        {dias.map(dia => {
          const iso = format(dia, "yyyy-MM-dd");
          const doMes = isSameMonth(dia, mes);
          const eHoje = isSameDay(dia, hoje);
          const escolhido = selecionado ? isSameDay(dia, selecionado) : false;

          return (
            <button
              key={iso}
              type="button"
              onClick={() => onChange(escolhido ? "" : iso)}
              aria-label={format(dia, "d 'de' MMMM", { locale: ptBR })}
              aria-pressed={escolhido}
              className={`aspect-square rounded-lg border-2 text-sm font-semibold transition-all active:scale-95 ${
                escolhido
                  ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/25"
                  : doMes
                    ? "border-border bg-background text-foreground hover:border-primary hover:bg-primary/10"
                    : "border-border/40 bg-muted/30 text-muted-foreground/50 hover:border-primary/40"
              } ${eHoje && !escolhido ? "ring-2 ring-primary/40" : ""}`}
            >
              {format(dia, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}
