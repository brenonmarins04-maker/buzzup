import { useState, useEffect, useCallback } from "react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, RefreshCw, AlertCircle, Lock } from "lucide-react";
import { getAreaLabel } from "@/lib/areas";
import { subDays, format } from "date-fns";
import { getNowBrasilia } from "@/lib/utils";

type SummaryRow = {
  summary_text: string;
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

  // Carrega do banco na montagem e assina atualizações em tempo real
  useEffect(() => {
    if (!activeWorkspaceId) return;
    let cancelled = false;

    const load = async () => {
      const { data } = await (supabase.from("workspace_summaries") as any)
        .select("summary_text, generated_at, generated_by")
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
        const newRow = payload.new as SummaryRow | null;
        if (newRow?.summary_text) setRow(newRow);
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
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
    const sevenAgoStr = format(subDays(today, 7), "yyyy-MM-dd");

    const pending = parkingItems
      .filter(p => p.status !== "done")
      .map(p => ({
        title: p.title,
        area: getAreaLabel(p.area ?? ""),
        person: personName(p.personId ?? ""),
        date: p.date ?? null,
        status: p.status,
        points: p.points ?? null,
      }));

    const completed = parkingItems
      .filter(p => p.status === "done" && p.date && p.date >= sevenAgoStr && p.date <= todayStr)
      .map(p => ({
        title: p.title,
        area: getAreaLabel(p.area ?? ""),
        person: personName(p.personId ?? ""),
        date: p.date ?? null,
        status: "done",
        points: p.points ?? null,
      }));

    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pending, completed, workspaceName }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data?.error === "no_api_key") {
          setError("Chave da API de IA não configurada. Adicione ANTHROPIC_API_KEY nas variáveis de ambiente da Vercel.");
        } else {
          setError(data?.message || "Erro ao gerar resumo.");
        }
        return;
      }

      const text: string = data.summary ?? "";
      const generatedAt = new Date().toISOString();

      // Salva no Supabase (upsert — cria ou sobrescreve)
      const { error: dbErr } = await (supabase.from("workspace_summaries") as any).upsert({
        workspace_id: activeWorkspaceId,
        summary_text: text,
        generated_at: generatedAt,
        generated_by: user.id,
      }, { onConflict: "workspace_id" });

      if (dbErr) {
        setError("Resumo gerado mas falhou ao salvar. Verifique se rodou o SQL summary-setup.sql.");
        // Mesmo assim exibe localmente
        setRow({ summary_text: text, generated_at: generatedAt, generated_by: user.id });
        return;
      }
      // Realtime vai atualizar o row; fallback local:
      setRow({ summary_text: text, generated_at: generatedAt, generated_by: user.id });
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

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" /> Resumo IA
        </h2>
        {isAdmin && row && !generating && (
          <button
            onClick={generate}
            className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="h-3 w-3" /> Atualizar
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-xs">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {(loading || generating) && (
        <div className="flex flex-col items-center gap-3 py-6 text-muted-foreground">
          <div className="h-7 w-7 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
          <p className="text-xs">{generating ? "Gerando resumo com IA…" : "Carregando…"}</p>
        </div>
      )}

      {!loading && !generating && !row && !error && (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          {isAdmin ? (
            <>
              <p className="text-xs text-muted-foreground">
                A IA analisa todas as demandas do workspace e gera um resumo executivo compartilhado com toda a equipe.
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

      {!loading && !generating && row?.summary_text && (
        <div className="space-y-2">
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{row.summary_text}</p>
          <p className="text-[10px] text-muted-foreground">
            Atualizado em {fmtTime(row.generated_at)}
            {!isAdmin && " · apenas diretores podem atualizar"}
          </p>
        </div>
      )}
    </div>
  );
}
