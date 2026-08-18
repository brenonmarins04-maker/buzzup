import { useMemo, useState } from "react";
import { useData, type Person, type ParkingItem } from "@/contexts/DataContext";
import { Button } from "@/components/ui/button";
import { Copy, Check, MessageSquare, RotateCcw, Users } from "lucide-react";
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

const GERAL_KEY = "__geral__";

/** Prazo da demanda no formato usado nas mensagens. */
export function prazoLabel(date?: string | null): string {
  const d = formatDemandDayMonth(date);
  return d ? `até ${d}` : "data indefinida";
}

/** Mensagem individual, pronta para colar no WhatsApp/Slack. */
export function buildCobrancaMessage(
  personName: string,
  demands: ParkingItem[],
  scopeLabel: string,
): string {
  const firstName = personName.split(" ")[0];
  const linhas = demands.map(d => `• ${d.title} — ${prazoLabel(d.date)}`);
  return [
    `Oi, ${firstName}! Passando pra lembrar das suas demandas de ${scopeLabel}:`,
    "",
    ...linhas,
    "",
    "Consegue dar um retorno? Valeu! 🙌",
  ].join("\n");
}

/** Mensagem única para o grupo: nome da pessoa - demanda - data. */
export function buildMensagemGeral(
  grupos: { person: Person; demands: ParkingItem[] }[],
  scopeLabel: string,
): string {
  const linhas = grupos.flatMap(({ person, demands }) => {
    const firstName = person.name.split(" ")[0];
    return demands.map(d => `• ${firstName} - ${d.title} - ${prazoLabel(d.date)}`);
  });
  return [
    `Fala pessoal, tudo bem? Não esqueçam das demandas da semana de ${scopeLabel}:`,
    "",
    ...linhas,
    "",
    "Qualquer dúvida é só chamar! 🙌",
  ].join("\n");
}

export default function CobrancaTab({ areaKey, members, scopeLabel }: Props) {
  const { parkingItems } = useData();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // Textos editados pelo usuário; sem entrada aqui, usa o texto gerado
  const [editado, setEditado] = useState<Record<string, string>>({});
  const today = getTodayBrasilia();

  // Demandas pendentes de cada pessoa neste escopo. Por data, sem prazo no fim.
  const porPessoa = useMemo(() => {
    const pendentes = parkingItems.filter(p => p.area === areaKey && p.status !== "done");
    return members
      .map(person => {
        const demands = pendentes
          .filter(d => d.personId === person.id)
          .sort((a, b) => {
            if (!a.date && !b.date) return a.title.localeCompare(b.title);
            if (!a.date) return 1;
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

  const totalDemandas = porPessoa.reduce((acc, x) => acc + x.demands.length, 0);

  if (porPessoa.length === 0) {
    return (
      <div className="glass-panel-soft rounded-2xl py-12 px-4 text-center">
        <Check className="h-8 w-8 text-emerald-500/60 mx-auto mb-2" />
        <p className="text-sm font-medium text-foreground">Ninguém com demanda pendente.</p>
        <p className="text-xs text-muted-foreground mt-1">Não há nada para cobrar por aqui. 🎉</p>
      </div>
    );
  }

  /** Bloco de mensagem editável + copiar. */
  const MessageBox = ({ id, gerado }: { id: string; gerado: string }) => {
    const texto = editado[id] ?? gerado;
    const foiEditado = editado[id] !== undefined && editado[id] !== gerado;
    const copiado = copiedId === id;
    return (
      <>
        <textarea
          value={texto}
          onChange={e => setEditado(prev => ({ ...prev, [id]: e.target.value }))}
          rows={Math.min(Math.max(texto.split("\n").length + 1, 6), 16)}
          spellCheck={false}
          className="w-full text-[11px] leading-relaxed text-foreground bg-muted/40 rounded-xl p-3 border border-transparent focus:border-primary/40 focus:bg-background focus:outline-none resize-y font-sans"
        />
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => copiar(id, texto)} className="rounded-xl" variant={copiado ? "outline" : "default"}>
            {copiado
              ? <><Check className="h-3.5 w-3.5 mr-1" /> Copiado</>
              : <><Copy className="h-3.5 w-3.5 mr-1" /> Copiar</>}
          </Button>
          {foiEditado && (
            <Button
              size="sm"
              variant="ghost"
              className="rounded-xl text-muted-foreground"
              onClick={() => setEditado(prev => { const n = { ...prev }; delete n[id]; return n; })}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restaurar
            </Button>
          )}
          {foiEditado && <span className="text-[10px] text-muted-foreground">editada</span>}
        </div>
      </>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <MessageSquare className="h-4 w-4 text-primary shrink-0" />
        <p className="text-xs text-muted-foreground">
          {porPessoa.length} pessoa{porPessoa.length > 1 ? "s" : ""} com{" "}
          {totalDemandas} demanda{totalDemandas > 1 ? "s" : ""} pendente{totalDemandas > 1 ? "s" : ""}.
          Edite se quiser e copie para colar no WhatsApp ou no Slack.
        </p>
      </div>

      {/* Mensagem geral — uma só, para mandar no grupo */}
      <div className="glass-panel-soft rounded-2xl p-4 flex flex-col gap-3 border-primary/30">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Users className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Mensagem geral</p>
              <p className="text-[11px] text-muted-foreground">
                Todas as pendências do grupo em uma mensagem só
              </p>
            </div>
          </div>
        </div>
        <MessageBox id={GERAL_KEY} gerado={buildMensagemGeral(porPessoa, scopeLabel)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {porPessoa.map(({ person, demands }) => {
          const atrasadas = demands.filter(d => isDemandOverdue(d, today)).length;
          return (
            <div key={person.id} className="glass-panel-soft rounded-2xl p-4 flex flex-col gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{person.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {demands.length} pendente{demands.length > 1 ? "s" : ""}
                  {atrasadas > 0 && (
                    <span className="text-red-600 font-semibold"> · {atrasadas} atrasada{atrasadas > 1 ? "s" : ""}</span>
                  )}
                </p>
              </div>
              <MessageBox id={person.id} gerado={buildCobrancaMessage(person.name, demands, scopeLabel)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
