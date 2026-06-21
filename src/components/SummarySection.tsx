import { useState, useEffect, useCallback } from "react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, RefreshCw, AlertCircle, Lock } from "lucide-react";
import { AREAS_DEFAULT, getAreaLabel, getAreaColor } from "@/lib/areas";
import { addDays, format } from "date-fns";
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

  // Carrega do banco na montagem e assina Realtime
  useEffect(() => {
    if (!activeWorkspaceId) return;
    let cancelled = false;

    const load = async () => {
      const { data } = await (supabase.from("workspace_summaries") as any)
        .select("summaries, generated_at, generated_by")
        .eq("workspace_id", activeWorkspaceId)
        .maybeSingle();
      if (!cancelled) {
        setRow(data ?? null);
        setLoading(false);
      }
    };
    load();

    const ch = supabase
      .channel(`summary-${activeWorkspaceId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "workspace_summaries",
        filter: `workspace_id=eq.${activeWorkspaceId}`,
      }, (payload) => {
        const r = payload.new as SummaryRow | null;
        if (r?.summaries) setRow(r);
      })
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

    // Demandas das próximas 3 semanas, pendentes
    const upcoming = parkingItems.filter(
      p => p.status !== "done" && p.date && p.date >= todayStr && p.date <= in21Str
    );

    // Agrupa por área
    const areas: Record<string, { areaName: string; demands: { title: string; person: string }[] }> = {};
    AREAS_DEFAULT.forEach(a => {
      areas[a.key] = { areaName: getAreaLabel(a.key) || a.label, demands: [] };
    });
    upcoming.forEach(p => {
      if (p.area && areas[p.area]) {
        areas[p.area].demands.push({
          title: p.title,
          person: personName(p.personId ?? ""),
        });
      }
    });

    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ areas }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.error === "no_api_key"
          ? "Chave da API não configurada na Vercel (ANTHROPIC_API_KEY)."
          : data?.message || "Erro ao gerar resumo.");
        return;
      }

      const summaries: Record<string, string> = data.summaries ?? {};
      const generatedAt = new Date().toISOString();

      const { error: dbErr } = await (supabase.from("workspace_summaries") as any).upsert({
        workspace_id: activeWorkspaceId,
        summaries,
        generated_at: generatedAt,
        generated_by: user.id,
      }, { onConflict: "workspace_id" });

      if (dbErr) {
        setError("Resumo gerado mas falhou ao salvar. Rode o summary-setup.sql no Supabase.");
      }
      setRow({ summaries, generated_at: generatedAt, generated_by: user.id });
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  };

  const fmtTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit", month: "2-digit",
        hour: "2-digit", minute: "2-digit",
      });
    } catch { return ""; }
  };

  const hasSummaries = row && row.summaries && typeof row.summaries === "object" && Object.keys(row.summaries).length > 0;

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" /> Resumo IA
        </h2>
        {isAdmin && hasSummaries && !generating && (
          <button
            onClick={generate}
            className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="h-3 w-3" /> Atualizar
          </button>
        )}
      </div>

      {/* Seletor de área */}
      {hasSummaries && !generating && (
        <div className="flex gap-1 flex-wrap">
          {AREAS_DEFAULT.map(a => {
            const color = getAreaColor(a.key);
            const label = getAreaLabel(a.key) || a.label;
            const active = selectedArea === a.key;
            return (
              <button
                key={a.key}
                onClick={() => setSelectedArea(a.key)}
                className="px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all"
                style={active
                  ? { backgroundColor: `${color}22`, color, borderColor: `${color}66` }
                  : { backgroundColor: "transparent", color: "var(--muted-foreground)", borderColor: "var(--border)" }
                }
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-xs">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading / Generating */}
      {(loading || generating) && (
        <div className="flex flex-col items-center gap-3 py-6 text-muted-foreground">
          <div className="h-7 w-7 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
          <p className="text-xs">{generating ? "Gerando resumos com IA…" : "Carregando…"}</p>
        </div>
      )}

      {/* Sem resumo ainda */}
      {!loading && !generating && !hasSummaries && !error && (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          {isAdmin ? (
            <>
              <p className="text-xs text-muted-foreground">
                A IA analisa as demandas das próximas 3 semanas por área e gera um resumo compartilhado com toda a equipe.
              </p>
              <button
                onClick={generate}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/15 text-violet-700 hover:bg-violet-500/25 border border-violet-300/60 text-sm font-semibold transition-all active:scale-95"
              >
                <Sparkles className="h-4 w-4" /> Gerar resumo
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Lock className="h-5 w-5 opacity-40" />
              <p className="text-xs">Nenhum resumo gerado ainda. Aguarde um diretor gerar o resumo da semana.</p>
            </div>
          )}
        </div>
      )}

      {/* Resumo da área selecionada */}
      {!loading && !generating && hasSummaries && (
        <div className="space-y-2">
          <p className="text-sm text-foreground leading-relaxed">
            {row!.summaries?.[selectedArea] || `Sem demandas previstas para ${getAreaLabel(selectedArea)} nas próximas semanas.`}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Atualizado em {fmtTime(row!.generated_at)}
            {!isAdmin && " · atualizado toda sexta às 15h"}
          </p>
        </div>
      )}
    </div>
  );
}
