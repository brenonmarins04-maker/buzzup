import { useMemo, useState } from "react";
import { Check, ClipboardList, Inbox, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { isLeaderOfAny } from "@/lib/leadership";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MonthDayPicker from "@/components/demandas/MonthDayPicker";
import {
  buildScopes, clampPoints, pendingRequests, scopeLabel, shortDate, SUGGESTED_POINTS,
  type DemandRequest,
} from "@/lib/demandRequests";

export default function DemandRequestsPage() {
  const { people, teams, demandRequests, acceptDemandRequest, rejectDemandRequest } = useData();
  const { isAdmin, user } = useAuth();

  // Mesma regra das demandas: diretores e líderes
  const podeDecidir = isAdmin || isLeaderOfAny(people, user?.id);

  const [revisando, setRevisando] = useState<DemandRequest | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const fila = useMemo(() => pendingRequests(demandRequests), [demandRequests]);
  const nomeDe = (personId: string) => people.find(p => p.id === personId)?.name ?? "—";

  if (!podeDecidir) {
    return (
      <div className="p-6 text-center">
        <ClipboardList className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium text-foreground">Esta tela é dos líderes e diretores.</p>
      </div>
    );
  }

  const aceitarDireto = async (r: DemandRequest) => {
    setOcupado(r.id);
    await acceptDemandRequest(r.id, { area: r.area, title: r.title, points: r.points, date: r.date });
    setOcupado(null);
    toast.success(`"${r.title}" virou demanda de ${nomeDe(r.personId)}.`);
  };

  const recusar = async (r: DemandRequest) => {
    setOcupado(r.id);
    await rejectDemandRequest(r.id);
    setOcupado(null);
    toast.success("Pedido recusado.");
  };

  return (
    <div className="animate-fade-in space-y-4 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <ClipboardList className="h-6 w-6 text-primary" />
          Demandas enviadas
        </h1>
        <p className="text-sm text-muted-foreground">
          O que os membros propuseram para si. Aceite para virar demanda de verdade.
        </p>
      </div>

      {fila.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Inbox className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium text-foreground">Nada esperando decisão.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Quando alguém enviar uma demanda, ela aparece aqui na hora.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {fila.map(r => (
            <div key={r.id} className="glass-panel rounded-2xl p-3">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground">{r.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                      {scopeLabel(r.area, teams)}
                    </span>
                    <span>{nomeDe(r.personId)}</span>
                    <span>· {r.points} {r.points === 1 ? "pt" : "pts"}</span>
                    <span>· {r.date ? `até ${shortDate(r.date)}` : "sem prazo"}</span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={ocupado === r.id}
                    onClick={() => setRevisando(r)}
                  >
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Revisar
                  </Button>
                  <Button
                    size="sm"
                    disabled={ocupado === r.id}
                    onClick={() => aceitarDireto(r)}
                    className="font-bold"
                  >
                    <Check className="mr-1 h-3.5 w-3.5" /> Aceitar
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ReviewDialog
        pedido={revisando}
        onOpenChange={v => { if (!v) setRevisando(null); }}
        onConfirmar={async (patch) => {
          if (!revisando) return;
          setOcupado(revisando.id);
          await acceptDemandRequest(revisando.id, patch);
          setOcupado(null);
          setRevisando(null);
          toast.success(`"${patch.title}" virou demanda.`);
        }}
        onRecusar={async () => {
          if (!revisando) return;
          const r = revisando;
          setRevisando(null);
          await recusar(r);
        }}
      />
    </div>
  );
}

/** Revisar: os dados que a pessoa mandou, abertos para ajuste antes de aceitar. */
function ReviewDialog({
  pedido, onOpenChange, onConfirmar, onRecusar,
}: {
  pedido: DemandRequest | null;
  onOpenChange: (v: boolean) => void;
  onConfirmar: (patch: { area: string; title: string; points: number; date: string }) => Promise<void>;
  onRecusar: () => Promise<void>;
}) {
  const { teams } = useData();
  const escopos = useMemo(() => buildScopes(teams), [teams]);

  const [area, setArea] = useState("");
  const [title, setTitle] = useState("");
  const [points, setPoints] = useState(1);
  const [date, setDate] = useState("");

  // Reabre sempre com o que a pessoa enviou
  const idAtual = pedido?.id ?? null;
  const [carregadoDe, setCarregadoDe] = useState<string | null>(null);
  if (pedido && carregadoDe !== idAtual) {
    setCarregadoDe(idAtual);
    setArea(pedido.area);
    setTitle(pedido.title);
    setPoints(pedido.points);
    setDate(pedido.date);
  }

  if (!pedido) return null;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Revisar demanda</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label htmlFor="rev-titulo" className="text-xs font-semibold text-muted-foreground">Nome</label>
            <Input id="rev-titulo" value={title} onChange={e => setTitle(e.target.value)} className="mt-1" maxLength={120} />
          </div>

          <div>
            <span className="text-xs font-semibold text-muted-foreground">Área ou time</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {escopos.map(e => (
                <button
                  key={e.key}
                  type="button"
                  onClick={() => setArea(e.key)}
                  aria-pressed={area === e.key}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    area === e.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-xs font-semibold text-muted-foreground">Pontos</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {SUGGESTED_POINTS.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPoints(p)}
                  aria-pressed={points === p}
                  className={`h-9 min-w-[44px] rounded-lg border-2 text-sm font-bold transition-colors ${
                    points === p ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
                  }`}
                >
                  {p}
                </button>
              ))}
              <Input
                type="number" min={0} max={99} value={points}
                onChange={e => setPoints(clampPoints(Number(e.target.value)))}
                aria-label="Outra quantidade de pontos"
                className="h-9 w-20"
              />
            </div>
          </div>

          <div>
            <span className="text-xs font-semibold text-muted-foreground">
              Prazo {date ? `— ${shortDate(date)}` : "— sem prazo"}
            </span>
            <div className="mt-1">
              <MonthDayPicker value={date} onChange={setDate} />
            </div>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <Button variant="ghost" onClick={onRecusar} className="text-muted-foreground hover:text-destructive">
            <X className="mr-1 h-4 w-4" /> Recusar
          </Button>
          <Button
            onClick={() => onConfirmar({ area, title, points, date })}
            disabled={!title.trim() || !area}
            className="ml-auto font-bold"
          >
            <Check className="mr-1 h-4 w-4" /> Aceitar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
