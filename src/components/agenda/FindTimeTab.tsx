import { useMemo, useState } from "react";
import { CalendarPlus, Info, Search, Sparkles } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { AREAS, getAreaLabel } from "@/lib/areas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  buildTimeOptions,
  durationLabel,
  minutesToLabel,
  peopleOfArea,
  weekdayLabel,
  WEEKDAYS,
  WEEKDAYS_UTEIS,
} from "@/lib/agenda";
import {
  DURATION_OPTIONS,
  findCommonWindows,
  peopleWithoutSchedule,
} from "@/lib/unavailability";
import type { SlotSeed } from "@/pages/AgendaPage";

const TIME_OPTIONS = buildTimeOptions();

/**
 * Chip de time/área, marcado quando o grupo inteiro está na seleção.
 *
 * Fica fora do componente de propósito: definido lá dentro, cada render criaria
 * um tipo novo e o React trocaria o nó do DOM — o chip nunca refletiria o
 * próprio estado.
 */
function GrupoChip({
  label, ativo, vazio, onToggle,
}: {
  label: string; ativo: boolean; vazio: boolean; onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={ativo}
      disabled={vazio}
      title={vazio ? "Ninguém neste grupo" : undefined}
      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
        ativo ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
      }`}
    >
      {label}
    </button>
  );
}

export default function FindTimeTab({ onMarcar }: { onMarcar: (s: SlotSeed) => void }) {
  const { people, teams, meetings, unavailability } = useData();

  const [personIds, setPersonIds] = useState<string[]>([]);
  const [busca, setBusca] = useState("");
  const [limiteInicio, setLimiteInicio] = useState(8 * 60);
  const [limiteFim, setLimiteFim] = useState(18 * 60);
  const [duracao, setDuracao] = useState(60);
  const [incluirFds, setIncluirFds] = useState(false);
  const [buscou, setBuscou] = useState(false);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return people;
    return people.filter(p => p.name.toLowerCase().includes(q));
  }, [people, busca]);

  const toggle = (id: string) => {
    setPersonIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    setBuscou(false);
  };

  /**
   * Grupos (times e áreas) funcionam como seleção: com todo mundo já marcado,
   * clicar tira o grupo inteiro; caso contrário, completa a seleção.
   */
  const grupoSelecionado = (ids: string[]) =>
    ids.length > 0 && ids.every(id => personIds.includes(id));

  const alternarGrupo = (ids: string[]) => {
    if (ids.length === 0) return;
    setPersonIds(prev => grupoSelecionado(ids)
      ? prev.filter(id => !ids.includes(id))
      : Array.from(new Set([...prev, ...ids])));
    setBuscou(false);
  };


  const limiteInvalido = limiteFim <= limiteInicio;
  const janelaMenorQueDuracao = !limiteInvalido && limiteFim - limiteInicio < duracao;
  const podeBuscar = personIds.length > 0 && !limiteInvalido && !janelaMenorQueDuracao;

  const weekdays = (incluirFds ? WEEKDAYS : WEEKDAYS_UTEIS).map(d => d.key);

  const janelas = useMemo(() => {
    if (!buscou || !podeBuscar) return [];
    return findCommonWindows({
      personIds, people, teams, meetings, unavailability,
      limite: { startMin: limiteInicio, endMin: limiteFim },
      minDuration: duracao,
      weekdays,
    });
  }, [buscou, podeBuscar, personIds, people, teams, meetings, unavailability,
      limiteInicio, limiteFim, duracao, weekdays]);

  const semAgenda = useMemo(
    () => (buscou ? peopleWithoutSchedule(personIds, people, unavailability) : []),
    [buscou, personIds, people, unavailability],
  );

  // Agrupa por dia, na ordem da semana
  const porDia = useMemo(() => {
    const map = new Map<number, typeof janelas>();
    for (const j of janelas) {
      const lista = map.get(j.weekday) ?? [];
      lista.push(j);
      map.set(j.weekday, lista);
    }
    return (incluirFds ? WEEKDAYS : WEEKDAYS_UTEIS)
      .map(d => ({ dia: d.key, janelas: (map.get(d.key) ?? []).sort((a, b) => a.startMin - b.startMin) }))
      .filter(g => g.janelas.length > 0);
  }, [janelas, incluirFds]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
          <Sparkles className="h-5 w-5 text-primary" />
          Achar horário em comum
        </h2>
        <p className="text-sm text-muted-foreground">
          Escolha as pessoas e o BuzzUp mostra quando todas estão livres.
        </p>
      </div>

      {/* Pessoas */}
      <div className="glass-panel rounded-2xl p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-bold text-foreground">
            Quem precisa estar {personIds.length > 0 && `(${personIds.length})`}
          </span>
          {personIds.length > 0 && (
            <button
              type="button"
              onClick={() => { setPersonIds([]); setBuscou(false); }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Limpar seleção
            </button>
          )}
        </div>

        {/* Times e áreas: clicar marca o grupo, clicar de novo desmarca */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {teams.map(t => (
            <GrupoChip
              key={t.id}
              label={t.name}
              ativo={grupoSelecionado(t.memberIds)}
              vazio={t.memberIds.length === 0}
              onToggle={() => alternarGrupo(t.memberIds)}
            />
          ))}
          {AREAS.map(a => {
            const ids = peopleOfArea(people, a.key).map(p => p.id);
            return (
              <GrupoChip
                key={a.key}
                label={getAreaLabel(a.key)}
                ativo={grupoSelecionado(ids)}
                vazio={ids.length === 0}
                onToggle={() => alternarGrupo(ids)}
              />
            );
          })}
        </div>

        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar pessoa..."
            className="pl-8"
          />
        </div>

        <div className="mt-2 max-h-52 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
          {filtradas.map(p => (
            <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-accent">
              <Checkbox checked={personIds.includes(p.id)} onCheckedChange={() => toggle(p.id)} />
              <span className="text-sm">{p.name}</span>
            </label>
          ))}
          {filtradas.length === 0 && (
            <p className="px-1.5 py-2 text-sm text-muted-foreground">Ninguém encontrado.</p>
          )}
        </div>
      </div>

      {/* Limites de horário */}
      <div className="glass-panel space-y-3 rounded-2xl p-3">
        <span className="text-sm font-bold text-foreground">Procurar só entre</span>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">A partir das</label>
            <Select value={String(limiteInicio)} onValueChange={v => { setLimiteInicio(Number(v)); setBuscou(false); }}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-64">
                {TIME_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Até as</label>
            <Select value={String(limiteFim)} onValueChange={v => { setLimiteFim(Number(v)); setBuscou(false); }}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-64">
                {TIME_OPTIONS.filter(o => o.value > limiteInicio).map(o => (
                  <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Duração da reunião</label>
          <Select value={String(duracao)} onValueChange={v => { setDuracao(Number(v)); setBuscou(false); }}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DURATION_OPTIONS.map(o => (
                <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <label className="flex cursor-pointer items-center gap-2">
          <Checkbox checked={incluirFds} onCheckedChange={v => { setIncluirFds(v === true); setBuscou(false); }} />
          <span className="text-sm text-muted-foreground">Considerar fim de semana</span>
        </label>

        {janelaMenorQueDuracao && (
          <p className="text-sm text-red-400">
            A janela escolhida é menor que a duração da reunião.
          </p>
        )}

        <Button
          onClick={() => setBuscou(true)}
          disabled={!podeBuscar}
          className="w-full rounded-xl font-bold"
        >
          <Search className="mr-1.5 h-4 w-4" />
          Achar horário
        </Button>
        {personIds.length === 0 && (
          <p className="text-center text-xs text-muted-foreground">
            Escolha ao menos uma pessoa.
          </p>
        )}
      </div>

      {/* Resultado */}
      {buscou && (
        <div className="space-y-3">
          {semAgenda.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <p className="text-sm text-foreground/90">
                {semAgenda.map(p => p.name).join(", ")}
                {semAgenda.length === 1 ? " ainda não marcou" : " ainda não marcaram"} horários ocupados.
                Contei como livre em todo o intervalo, tirando só as reuniões já marcadas.
              </p>
            </div>
          )}

          {porDia.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center">
              <p className="text-sm font-medium text-foreground">
                Nenhum horário serve para todo mundo.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Tente aumentar o intervalo, encurtar a reunião ou tirar alguém da lista.
              </p>
            </div>
          ) : (
            porDia.map(({ dia, janelas: lista }) => (
              <div key={dia} className="glass-panel rounded-2xl p-3">
                <h3 className="mb-2 text-sm font-bold text-foreground">{weekdayLabel(dia)}</h3>
                <div className="space-y-1.5">
                  {lista.map(j => (
                    <div
                      key={`${j.startMin}-${j.endMin}`}
                      className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-2.5 py-2"
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
                      <span className="text-sm font-bold tabular-nums text-foreground">
                        {minutesToLabel(j.startMin)}–{minutesToLabel(j.endMin)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {durationLabel(j.startMin, j.endMin)} livre
                      </span>
                      <Button
                        size="sm"
                        onClick={() => onMarcar({
                          weekday: dia,
                          startMin: j.startMin,
                          // A reunião ocupa só a duração pedida, no começo da janela
                          endMin: Math.min(j.startMin + duracao, j.endMin),
                          personIds,
                        })}
                        className="ml-auto rounded-lg"
                      >
                        <CalendarPlus className="mr-1 h-3.5 w-3.5" />
                        Marcar
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
