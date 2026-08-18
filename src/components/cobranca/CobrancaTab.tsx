import { useMemo, useState } from "react";
import { useData, type Person, type ParkingItem } from "@/contexts/DataContext";
import { Button } from "@/components/ui/button";
import { Copy, Check, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { formatDemandDayMonth, isDemandOverdue } from "@/lib/demandStatus";
import { getTodayBrasilia } from "@/lib/utils";

type Props = {
  /** Chave da área ("mercado") ou do time ("team_<id>") */
  areaKey: string;
  /** Pessoas do escopo (membros da área ou do time) */
  members: Person[];
  /** Nome do escopo, usado no texto da mensagem */
  scopeLabel: string;
};

/** Monta a mensagem pronta para colar no WhatsApp/Slack. */
export function buildCobrancaMessage(
  personName: string,
  demands: ParkingItem[],
  scopeLabel: string,
): string {
  const firstName = personName.split(" ")[0];
  const linhas = demands.map(d => {
    const data = formatDemandDayMonth(d.date);
    return `• ${d.title} — ${data ? `até ${data}` : "data indefinida"}`;
  });
  return [
    `Oi, ${firstName}! Passando pra lembrar das suas demandas de ${scopeLabel}:`,
    "",
    ...linhas,
    "",
    "Consegue dar um retorno? Valeu! 🙌",
  ].join("\n");
}

export default function CobrancaTab({ areaKey, members, scopeLabel }: Props) {
  const { parkingItems } = useData();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const today = getTodayBrasilia();

  // Demandas pendentes de cada pessoa neste escopo. Atrasadas primeiro,
  // depois por data, e as sem prazo no fim.
  const porPessoa = useMemo(() => {
    const pendentes = parkingItems.filter(p => p.area === areaKey && p.status !== "done");
    return members
      .map(person => {
        const demands = pendentes
          .filter(d => d.personId === person.id)
          .sort((a, b) => {
            if (!a.date && !b.date) return a.title.localeCompare(b.title);
            if (!a.date) return 1;   // sem data vai para o fim
            if (!b.date) return -1;
            return a.date.localeCompare(b.date);
          });
        return { person, demands };
      })
      .filter(x => x.demands.length > 0)
      .sort((a, b) => b.demands.length - a.demands.length);
  }, [parkingItems, areaKey, members]);

  const copiar = async (id: string, texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiedId(id);
      setTimeout(() => setCopiedId(prev => (prev === id ? null : prev)), 2000);
      toast.success("Mensagem copiada!");
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto e copie manualmente.");
    }
  };

  const semPendencias = porPessoa.length === 0;
  const totalDemandas = porPessoa.reduce((acc, x) => acc + x.demands.length, 0);

  if (semPendencias) {
    return (
      <div className="glass-panel-soft rounded-2xl py-12 px-4 text-center">
        <Check className="h-8 w-8 text-emerald-500/60 mx-auto mb-2" />
        <p className="text-sm font-medium text-foreground">Ninguém com demanda pendente.</p>
        <p className="text-xs text-muted-foreground mt-1">Não há nada para cobrar por aqui. 🎉</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <MessageSquare className="h-4 w-4 text-primary shrink-0" />
        <p className="text-xs text-muted-foreground">
          {porPessoa.length} pessoa{porPessoa.length > 1 ? "s" : ""} com{" "}
          {totalDemandas} demanda{totalDemandas > 1 ? "s" : ""} pendente{totalDemandas > 1 ? "s" : ""}.
          Copie a mensagem e cole no WhatsApp ou no Slack.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {porPessoa.map(({ person, demands }) => {
          const mensagem = buildCobrancaMessage(person.name, demands, scopeLabel);
          const atrasadas = demands.filter(d => isDemandOverdue(d, today)).length;
          const copiado = copiedId === person.id;
          return (
            <div key={person.id} className="glass-panel-soft rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{person.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {demands.length} pendente{demands.length > 1 ? "s" : ""}
                    {atrasadas > 0 && (
                      <span className="text-red-600 font-semibold"> · {atrasadas} atrasada{atrasadas > 1 ? "s" : ""}</span>
                    )}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => copiar(person.id, mensagem)}
                  className="shrink-0 rounded-xl"
                  variant={copiado ? "outline" : "default"}
                >
                  {copiado
                    ? <><Check className="h-3.5 w-3.5 mr-1" /> Copiado</>
                    : <><Copy className="h-3.5 w-3.5 mr-1" /> Copiar</>}
                </Button>
              </div>

              {/* Prévia exata do que vai para a área de transferência */}
              <pre className="text-[11px] leading-relaxed text-foreground whitespace-pre-wrap break-words bg-muted/40 rounded-xl p-3 font-sans">
                {mensagem}
              </pre>
            </div>
          );
        })}
      </div>
    </div>
  );
}
