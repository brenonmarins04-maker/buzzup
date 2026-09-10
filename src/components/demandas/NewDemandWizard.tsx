import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CalendarDays, Check, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MonthDayPicker from "@/components/demandas/MonthDayPicker";
import {
  buildScopes, canAdvance, clampPoints, EMPTY_DRAFT, nextStep, prevStep,
  scopeLabel, shortDate, splitScopesForPerson, SUGGESTED_POINTS, WIZARD_STEPS,
  type DemandDraft, type DemandScope, type WizardStep,
} from "@/lib/demandRequests";

/** Grade de botões grandes. Fora do componente para não remontar a cada render. */
function ScopeGrid({
  escopos, selecionado, onEscolher,
}: {
  escopos: DemandScope[];
  selecionado: string | null;
  onEscolher: (key: string) => void;
}) {
  if (escopos.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2">
      {escopos.map(e => (
        <button
          key={e.key}
          type="button"
          onClick={() => onEscolher(e.key)}
          className={`flex min-h-[76px] flex-col items-start justify-end rounded-2xl border-2 p-3 text-left transition-all active:scale-95 ${
            selecionado === e.key
              ? "border-primary bg-primary/10"
              : "border-border bg-card hover:border-primary/50 hover:bg-accent"
          }`}
        >
          <span className="mb-1 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: e.color }} />
          <span className="text-sm font-bold leading-tight text-foreground">{e.label}</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {e.kind === "team" ? "Time" : "Área"}
          </span>
        </button>
      ))}
    </div>
  );
}

const TITULOS: Record<WizardStep, string> = {
  escopo: "Para qual área ou time?",
  demanda: "O que você vai fazer?",
  prazo: "Tem prazo?",
};

export default function NewDemandWizard({
  open, onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { people, teams, addDemandRequest } = useData();
  const { user } = useAuth();
  const [passo, setPasso] = useState<WizardStep>("escopo");
  const [draft, setDraft] = useState<DemandDraft>(EMPTY_DRAFT);
  const [enviando, setEnviando] = useState(false);
  const [verOutros, setVerOutros] = useState(false);
  const tituloRef = useRef<HTMLInputElement>(null);

  const escopos = useMemo(() => buildScopes(teams), [teams]);

  // Áreas e times de quem está enviando aparecem direto; o resto fica atrás
  // de um toque
  const { meus, outros } = useMemo(() => {
    const eu = people.find(p => p.userId === user?.id);
    return splitScopesForPerson(escopos, {
      personId: eu?.id ?? null,
      areas: eu?.areas && eu.areas.length ? eu.areas : (eu?.area ? [eu.area] : []),
    });
  }, [escopos, people, user?.id]);

  useEffect(() => {
    if (!open) return;
    setPasso("escopo");
    setDraft(EMPTY_DRAFT);
    setEnviando(false);
    setVerOutros(false);
  }, [open]);

  // Chegando no passo do nome, o cursor já fica no campo: no computador o
  // fluxo inteiro é digitar e apertar Enter
  useEffect(() => {
    if (passo === "demanda") setTimeout(() => tituloRef.current?.focus(), 60);
  }, [passo]);

  const avancar = () => {
    if (!canAdvance(passo, draft)) return;
    const prox = nextStep(passo);
    if (prox) setPasso(prox);
    else void enviar();
  };

  const voltar = () => {
    const ant = prevStep(passo);
    if (ant) setPasso(ant);
  };

  const enviar = async () => {
    if (!draft.area || !draft.title.trim() || enviando) return;
    setEnviando(true);
    const ok = await addDemandRequest(draft.area, draft.title, draft.points, draft.date);
    setEnviando(false);
    if (ok) onOpenChange(false);
  };

  /** Escolher a área já pula para o próximo passo — um toque, não dois. */
  const escolherEscopo = (key: string) => {
    setDraft(d => ({ ...d, area: key }));
    setPasso("demanda");
  };

  const indice = WIZARD_STEPS.indexOf(passo);
  const ultimo = indice === WIZARD_STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle className="text-base">{TITULOS[passo]}</DialogTitle>
          {/* Bolinhas de progresso: mostram que o fluxo é curto */}
          <div className="mt-2 flex items-center gap-1.5">
            {WIZARD_STEPS.map((s, i) => (
              <span
                key={s}
                className={`h-1.5 rounded-full transition-all ${
                  i === indice ? "w-6 bg-primary" : i < indice ? "w-1.5 bg-primary/40" : "w-1.5 bg-border"
                }`}
              />
            ))}
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {passo === "escopo" && (
            <div className="space-y-3">
              <ScopeGrid escopos={meus} selecionado={draft.area} onEscolher={escolherEscopo} />

              {meus.length === 0 && outros.length > 0 && (
                <p className="text-center text-xs text-muted-foreground">
                  Você não está em nenhuma área ou time ainda.
                </p>
              )}

              {outros.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setVerOutros(v => !v)}
                    aria-expanded={verOutros}
                    className="flex w-full items-center justify-center gap-1 rounded-xl py-2 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <ChevronDown className={`h-4 w-4 transition-transform ${verOutros ? "rotate-180" : ""}`} />
                    {verOutros
                      ? "Esconder as outras"
                      : `Outras áreas e times (${outros.length})`}
                  </button>
                  {verOutros && (
                    <div className="mt-2">
                      <ScopeGrid escopos={outros} selecionado={draft.area} onEscolher={escolherEscopo} />
                    </div>
                  )}
                </div>
              )}

              {escopos.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nenhuma área ou time disponível.
                </p>
              )}
            </div>
          )}

          {passo === "demanda" && (
            <div className="space-y-4">
              <div>
                <label htmlFor="demanda-titulo" className="text-xs font-semibold text-muted-foreground">
                  Nome da demanda
                </label>
                <Input
                  id="demanda-titulo"
                  ref={tituloRef}
                  value={draft.title}
                  onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); avancar(); } }}
                  placeholder="Ex.: Post para o Instagram"
                  maxLength={120}
                  className="mt-1 h-11"
                />
              </div>

              <div>
                <span className="text-xs font-semibold text-muted-foreground">Pontos sugeridos</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {SUGGESTED_POINTS.map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setDraft(d => ({ ...d, points: p }))}
                      aria-pressed={draft.points === p}
                      className={`h-11 min-w-[52px] rounded-xl border-2 text-sm font-bold transition-all active:scale-95 ${
                        draft.points === p
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-foreground hover:border-primary/50"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  <Input
                    type="number"
                    min={0}
                    max={99}
                    value={draft.points}
                    onChange={e => setDraft(d => ({ ...d, points: clampPoints(Number(e.target.value)) }))}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); avancar(); } }}
                    aria-label="Outra quantidade de pontos"
                    className="h-11 w-20"
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  É uma sugestão — quem aprovar pode mudar.
                </p>
              </div>
            </div>
          )}

          {passo === "prazo" && (
            <div className="space-y-3">
              <MonthDayPicker
                value={draft.date}
                onChange={iso => setDraft(d => ({ ...d, date: iso }))}
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {draft.date
                    ? <>Prazo: <span className="font-bold text-foreground">{shortDate(draft.date)}</span></>
                    : "Sem prazo — a demanda vai para as ideias."}
                </p>
                {draft.date && (
                  <button
                    type="button"
                    onClick={() => setDraft(d => ({ ...d, date: "" }))}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    Tirar prazo
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé fixo: o botão de continuar está sempre no mesmo lugar */}
        <div className="border-t border-border bg-card px-4 py-3">
          {draft.area && (
            <p className="mb-2 truncate text-[11px] text-muted-foreground">
              {scopeLabel(draft.area, teams)}
              {draft.title.trim() && <> · {draft.title.trim()}</>}
            </p>
          )}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={voltar}
              disabled={indice === 0}
              className={indice === 0 ? "invisible" : ""}
            >
              <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
            </Button>
            <Button
              onClick={avancar}
              disabled={!canAdvance(passo, draft) || enviando}
              className="ml-auto h-11 min-w-[140px] font-bold"
            >
              {ultimo
                ? <><Check className="mr-1.5 h-4 w-4" /> Enviar demanda</>
                : passo === "demanda"
                  ? <><CalendarDays className="mr-1.5 h-4 w-4" /> Continuar</>
                  : "Continuar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
