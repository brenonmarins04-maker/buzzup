import { useEffect, useMemo, useState } from "react";
import { useData, type Person } from "@/contexts/DataContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, MessageSquare, RotateCcw, Users } from "lucide-react";
import { toast } from "sonner";
import { formatDemandDayMonth, isDemandOverdue } from "@/lib/demandStatus";
import { getTodayBrasilia } from "@/lib/utils";

type Props = {
  /** Chave da área ("mercado") ou do time ("team_<id>") */
  areaKey: string;
  /** Pessoas do escopo (membros da área ou do time) */
  members: Person[];
  /** Nome do escopo, usado nos textos padrão */
  scopeLabel: string;
};

export type MsgOptions = { showName: boolean; showDate: boolean };

/** Prazo da demanda no formato usado nas mensagens. */
export function prazoLabel(date?: string | null): string {
  const d = formatDemandDayMonth(date);
  return d ? `até ${d}` : "data indefinida";
}

/** Uma linha do corpo: nome - demanda - data, conforme as opções ligadas. */
export function demandLine(
  title: string,
  date: string | null | undefined,
  personName: string | undefined,
  opts: MsgOptions,
): string {
  const partes: string[] = [];
  if (opts.showName && personName) partes.push(personName.split(" ")[0]);
  partes.push(title);
  if (opts.showDate) partes.push(prazoLabel(date));
  return `• ${partes.join(" - ")}`;
}

/** Junta a primeira linha (editável), o corpo (gerado) e a última (editável). */
export function composeMessage(header: string, lines: string[], footer: string): string {
  const blocos = [header.trim(), lines.join("\n"), footer.trim()].filter(Boolean);
  return blocos.join("\n\n");
}

export const DEFAULT_HEADER_GERAL = "Fala pessoal, tudo bem? Não esqueçam das demandas da semana:";
export const DEFAULT_HEADER_INDIV = "Oi, {nome}! Passando pra lembrar das suas demandas:";
export const DEFAULT_FOOTER = "Qualquer dúvida é só chamar! 🙌";

type Settings = {
  headerGeral: string;
  headerIndiv: string;
  footer: string;
  showName: boolean;
  showDate: boolean;
};

const defaultSettings = (): Settings => ({
  headerGeral: DEFAULT_HEADER_GERAL,
  headerIndiv: DEFAULT_HEADER_INDIV,
  footer: DEFAULT_FOOTER,
  showName: true,
  showDate: true,
});

export default function CobrancaTab({ areaKey, members, scopeLabel }: Props) {
  const { parkingItems } = useData();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const today = getTodayBrasilia();

  // Textos e opções ficam salvos por área/time — não se perdem ao navegar,
  // e não mudam quando as demandas são atualizadas.
  const storageKey = `buzzup.cobranca.${areaKey}`;
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      setSettings(raw ? { ...defaultSettings(), ...JSON.parse(raw) } : defaultSettings());
    } catch {
      setSettings(defaultSettings());
    }
  }, [storageKey]);

  const patch = (p: Partial<Settings>) => {
    setSettings(prev => {
      const next = { ...prev, ...p };
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* storage bloqueado */ }
      return next;
    });
  };

  const isCustom =
    settings.headerGeral !== DEFAULT_HEADER_GERAL
    || settings.headerIndiv !== DEFAULT_HEADER_INDIV
    || settings.footer !== DEFAULT_FOOTER;

  // Demandas pendentes por pessoa. Por data, com as sem prazo no fim.
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

  const opts: MsgOptions = { showName: settings.showName, showDate: settings.showDate };

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

  const Toggle = ({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) => (
    <button
      type="button"
      onClick={onClick}
      role="switch"
      aria-checked={on}
      className={`flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 rounded-xl border text-[11px] font-semibold transition-all ${
        on ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:text-foreground"
      }`}
    >
      {label}
      <span className={`h-3.5 w-6 rounded-full flex items-center p-0.5 transition-colors ${on ? "bg-white/30" : "bg-muted"}`}>
        <span className={`h-2.5 w-2.5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-2.5" : ""}`} />
      </span>
    </button>
  );

  /** Mensagem: primeira e última linha editáveis, corpo gerado. */
  const MessageCard = ({
    id, headerValue, onHeaderChange, headerHint, lines,
  }: {
    id: string;
    headerValue: string;
    onHeaderChange: (v: string) => void;
    headerHint?: string;
    lines: string[];
  }) => {
    const texto = composeMessage(headerValue.replace("{nome}", ""), lines, settings.footer);
    const copiado = copiedId === id;
    return (
      <>
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Primeira linha
          </label>
          <Input
            value={headerValue}
            onChange={e => onHeaderChange(e.target.value)}
            className="h-9 text-xs"
          />
          {headerHint && <p className="text-[10px] text-muted-foreground">{headerHint}</p>}
        </div>

        {/* Corpo: gerado a partir das demandas, muda só pelos botões acima */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Demandas (atualiza sozinho)
          </label>
          <pre className="text-[11px] leading-relaxed text-foreground whitespace-pre-wrap break-words bg-muted/40 rounded-xl p-3 font-sans">
            {lines.join("\n")}
          </pre>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Última linha
          </label>
          <Input
            value={settings.footer}
            onChange={e => patch({ footer: e.target.value })}
            className="h-9 text-xs"
          />
        </div>

        <Button
          size="sm"
          onClick={() => copiar(id, texto)}
          className="rounded-xl w-fit"
          variant={copiado ? "outline" : "default"}
        >
          {copiado
            ? <><Check className="h-3.5 w-3.5 mr-1" /> Copiado</>
            : <><Copy className="h-3.5 w-3.5 mr-1" /> Copiar mensagem</>}
        </Button>
      </>
    );
  };

  return (
    <div className="space-y-3">
      {/* Opções do corpo — valem para todas as mensagens */}
      <div className="glass-panel-soft rounded-2xl p-3 flex flex-wrap items-center gap-2">
        <MessageSquare className="h-4 w-4 text-primary shrink-0" />
        <span className="text-[11px] font-semibold text-foreground">O que aparece nas demandas:</span>
        <Toggle on={settings.showName} onClick={() => patch({ showName: !settings.showName })} label="Nome" />
        <Toggle on={settings.showDate} onClick={() => patch({ showDate: !settings.showDate })} label="Data" />
        {isCustom && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto rounded-xl text-muted-foreground text-[11px]"
            onClick={() => patch({
              headerGeral: DEFAULT_HEADER_GERAL,
              headerIndiv: DEFAULT_HEADER_INDIV,
              footer: DEFAULT_FOOTER,
            })}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restaurar textos
          </Button>
        )}
        <p className="basis-full text-[10px] text-muted-foreground">
          {porPessoa.length} pessoa{porPessoa.length > 1 ? "s" : ""} · {totalDemandas} demanda
          {totalDemandas > 1 ? "s" : ""} pendente{totalDemandas > 1 ? "s" : ""}. A primeira e a última
          linha você escreve; a lista de demandas se atualiza sozinha.
        </p>
      </div>

      {/* Mensagem geral — uma só, para o grupo */}
      <div className="glass-panel-soft rounded-2xl p-4 flex flex-col gap-3 border-primary/30">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Users className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Mensagem geral</p>
            <p className="text-[11px] text-muted-foreground">Todas as pendências de {scopeLabel} em uma mensagem</p>
          </div>
        </div>
        <MessageCard
          id="__geral__"
          headerValue={settings.headerGeral}
          onHeaderChange={v => patch({ headerGeral: v })}
          lines={porPessoa.flatMap(({ person, demands }) =>
            demands.map(d => demandLine(d.title, d.date, person.name, opts)),
          )}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {porPessoa.map(({ person, demands }) => {
          const atrasadas = demands.filter(d => isDemandOverdue(d, today)).length;
          const firstName = person.name.split(" ")[0];
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
              <MessageCard
                id={person.id}
                headerValue={settings.headerIndiv.replace("{nome}", firstName)}
                onHeaderChange={v => patch({ headerIndiv: v.replace(firstName, "{nome}") })}
                headerHint="Use {nome} para inserir o primeiro nome de cada pessoa."
                lines={demands.map(d => demandLine(d.title, d.date, person.name, opts))}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
