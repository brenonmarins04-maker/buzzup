import { useState, useEffect, useCallback } from "react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, RefreshCw, AlertCircle, Lock, User, CalendarDays } from "lucide-react";
import { AREAS_DEFAULT, getAreaLabel, getAreaColor } from "@/lib/areas";
import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getNowBrasilia } from "@/lib/utils";

type SummaryRow = {
  summaries: Record<string, string>;
  generated_at: string;
  generated_by: string | null;
};

export default function SummarySection() {
  const { parkingItems, people } = useData();
  const { myWorkspaces, activeWorkspaceId, isAdmin, user } = useAuth();

  const workspaceName = myWorkspaces.find(w => w.workspace_id === activeWorkspaceId)?.name;

  const [row, setRow] = useState<SummaryRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedArea, setSelectedArea] = useState<string>(AREAS_DEFAULT[0].key);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await (supabase.from("workspace_summaries") as any)
        .select("summaries, generated_at, generated_by")
        .eq("workspace_id", activeWorkspaceId)
        .maybeSingle();
      if (!cancelled) { setRow(data ?? null); setLoading(false); }
    };
    load();

    const ch = supabase
      .channel(`summary-${activeWorkspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "workspace_summaries", filter: `workspace_id=eq.${activeWorkspaceId}` },
        (payload) => { const r = payload.new as SummaryRow | null; if (r?.summaries) setRow(r); })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [activeWorkspaceId]);

  const personName = useCallback(
    (personId: string) => people.find(x => x.id === personId)?.name ?? "",
    [people]
  );

  const generate = async () => {
    if (!activeWorkspaceId || !user) return;
    setGenerating(true);
    setError(null);

    const today = getNowBrasilia();
    const todayStr = format(today, "yyyy-MM-dd");
    const in21Str = format(addDays(today, 21), "yyyy-MM-dd");

    const upcoming = parkingItems.filter(
      p => p.status !== "done" && p.date && p.date >= todayStr && p.date <= in21Str
    );

    const areas: Record<string, { areaName: string; demands: { title: string; person: string }[] }> = {};
    AREAS_DEFAULT.forEach(a => {
      areas[a.key] = { areaName: getAreaLabel(a.key) || a.label, demands: [] };
    });
    upcoming.forEach(p => {
      if (p.area && areas[p.area]) {
        areas[p.area].demands.push({ title: p.title, person: personName(p.personId ?? "") });
      }
    });

    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ areas }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error === "no_api_key"
          ? "Chave ANTHROPIC_API_KEY não configurada na Vercel."
          : data?.message || "Erro ao gerar resumo.");
        return;
      }

      const summaries: Record<string, string> = data?.summaries ?? {};
      const generatedAt = new Date().toISOString();

      const { error: dbErr } = await (supabase.from("workspace_summaries") as any).upsert({
        workspace_id: activeWorkspaceId,
        summaries,
        generated_at: generatedAt,
        generated_by: user.id,
      }, { onConflict: "workspace_id" });

      if (dbErr) {
        setError(`Falha ao salvar (${dbErr.message}). Rode o SQL de correção da RLS.`);
      }
      setRow({ summaries, generated_at: generatedAt, generated_by: user.id });
    } catch (e: any) {
      setError(e?.message || "Falha de conexão. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  };

  const fmtDate = (iso: string) => {
    try {
      return format(new Date(iso + "T12:00:00"), "dd MMM", { locale: ptBR });
    } catch { return ""; }
  };

  const fmtTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch { return ""; }
  };

  const hasSummaries = !!(row && row.summaries && typeof row.summaries === "object" && Object.keys(row.summaries).length > 0);

  // Demandas das próximas 3 semanas para a área selecionada
  const today = getNowBrasilia();
  const todayStr = format(today, "yyyy-MM-dd");
  const in21Str = format(addDays(today, 21), "yyyy-MM-dd");
  const areaColor = getAreaColor(selectedArea);
  const areaDemands = parkingItems
    .filter(p => p.area === selectedArea && p.status !== "done" && p.date && p.date >= todayStr && p.date <= in21Str)
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" /> Resumo IA
        </h2>
        {isAdmin && hasSummaries && !generating && (
          <button onClick={generate} className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className="h-3 w-3" /> Atualizar
          </button>
        )}
      </div>

      {/* Seletor de área */}
      <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto scrollbar-none">
        {AREAS_DEFAULT.map(a => {
          const color = getAreaColor(a.key);
          const label = getAreaLabel(a.key) || a.label;
          const active = selectedArea === a.key;
          return (
            <button key={a.key} onClick={() => setSelectedArea(a.key)}
              className="shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold border transition-all"
              style={active
                ? { backgroundColor: `${color}22`, color, borderColor: `${color}88` }
                : { backgroundColor: "transparent", color: "var(--muted-foreground)", borderColor: "var(--border)" }
              }>
              {label}
            </button>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-3 flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-xs">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading / Generating */}
      {(loading || generating) && (
        <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
          <div className="h-7 w-7 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
          <p className="text-xs">{generating ? "Gerando resumos com IA…" : "Carregando…"}</p>
        </div>
      )}

      {/* Sem resumo ainda */}
      {!loading && !generating && !hasSummaries && !error && (
        <div className="flex flex-col items-center gap-3 px-4 pb-5 text-center">
          {isAdmin ? (
            <>
              <p className="text-xs text-muted-foreground">A IA analisa as demandas das próximas 3 semanas por área e gera um resumo compartilhado com toda a equipe.</p>
              <button onClick={generate}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/15 text-violet-700 hover:bg-violet-500/25 border border-violet-300/60 text-sm font-semibold transition-all active:scale-95">
                <Sparkles className="h-4 w-4" /> Gerar resumo
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground py-2">
              <Lock className="h-5 w-5 opacity-40" />
              <p className="text-xs">Aguarde um diretor gerar o resumo da semana.</p>
            </div>
          )}
        </div>
      )}

      {/* Conteúdo */}
      {!loading && !generating && hasSummaries && (
        <div>
          {/* Faixa colorida da área */}
          <div className="mx-4 mb-3 rounded-lg p-3" style={{ backgroundColor: `${areaColor}12`, borderLeft: `3px solid ${areaColor}` }}>
            <p className="text-xs text-foreground leading-relaxed" style={{ color: "var(--foreground)" }}>
              {row!.summaries?.[selectedArea] || `Sem demandas previstas para ${getAreaLabel(selectedArea)} nas próximas semanas.`}
            </p>
          </div>

          {/* Lista de demandas da área */}
          {areaDemands.length > 0 && (
            <div className="flex flex-col border-t border-border">
              {areaDemands.map((d, i) => {
                const person = personName(d.personId ?? "");
                return (
                  <div key={d.id}
                    className={`flex items-start gap-3 px-4 py-2.5 ${i < areaDemands.length - 1 ? "border-b border-border/50" : ""}`}>
                    {/* Indicador de cor */}
                    <div className="mt-1 h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: areaColor }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground leading-snug truncate">{d.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {person && (
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <User className="h-2.5 w-2.5" /> {person.split(" ")[0]}
                          </span>
                        )}
                        {d.date && (
                          <span className="flex items-center gap-0.5 text-[10px] font-medium rounded px-1.5 py-0.5"
                            style={{ backgroundColor: `${areaColor}20`, color: areaColor }}>
                            <CalendarDays className="h-2.5 w-2.5" /> {fmtDate(d.date)}
                          </span>
                        )}
                        {d.points ? (
                          <span className="text-[10px] font-bold text-primary">+{d.points}p</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {areaDemands.length === 0 && hasSummaries && (
            <p className="text-[11px] text-muted-foreground text-center pb-3">Sem demandas agendadas para as próximas 3 semanas.</p>
          )}

          <div className="px-4 pt-2 pb-3 border-t border-border/50">
            <p className="text-[10px] text-muted-foreground">
              Atualizado em {fmtTime(row!.generated_at)}
              {!isAdmin && " · toda sexta às 15h"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
