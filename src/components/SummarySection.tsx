import { useState, useCallback } from "react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { Sparkles, RefreshCw, AlertCircle } from "lucide-react";
import { AREAS, getAreaLabel } from "@/lib/areas";
import { subDays, format } from "date-fns";
import { getNowBrasilia } from "@/lib/utils";

const CACHE_KEY = "buzzup.aiSummary";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

type Cached = { summary: string; generatedAt: string; workspaceId: string };

function loadCache(workspaceId: string): Cached | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c: Cached = JSON.parse(raw);
    if (c.workspaceId !== workspaceId) return null;
    if (Date.now() - new Date(c.generatedAt).getTime() > CACHE_TTL_MS) return null;
    return c;
  } catch { return null; }
}

function saveCache(summary: string, workspaceId: string) {
  try {
    const c: Cached = { summary, generatedAt: new Date().toISOString(), workspaceId };
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {}
}

export default function SummarySection() {
  const { parkingItems, people } = useData();
  const { myWorkspaces, activeWorkspaceId } = useAuth();

  const workspaceName = myWorkspaces.find(w => w.workspace_id === activeWorkspaceId)?.name;
  const cached = activeWorkspaceId ? loadCache(activeWorkspaceId) : null;

  const [summary, setSummary] = useState<string>(cached?.summary ?? "");
  const [generatedAt, setGeneratedAt] = useState<string>(cached?.generatedAt ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const personName = useCallback((personId: string) => {
    const p = people.find(x => x.id === personId);
    return p?.name ?? "";
  }, [people]);

  const areaLabel = useCallback((areaKey: string) => getAreaLabel(areaKey), []);

  const generate = async () => {
    setLoading(true);
    setError(null);

    const today = getNowBrasilia();
    const todayStr = format(today, "yyyy-MM-dd");
    const sevenAgoStr = format(subDays(today, 7), "yyyy-MM-dd");

    const pending = parkingItems
      .filter(p => p.status !== "done")
      .map(p => ({
        title: p.title,
        area: areaLabel(p.area ?? ""),
        person: personName(p.personId ?? ""),
        date: p.date ?? null,
        status: p.status,
        points: p.points ?? null,
      }));

    const completed = parkingItems
      .filter(p => p.status === "done" && p.date && p.date >= sevenAgoStr && p.date <= todayStr)
      .map(p => ({
        title: p.title,
        area: areaLabel(p.area ?? ""),
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
        const msg = data?.message || "Erro ao gerar resumo.";
        if (data?.error === "no_api_key") {
          setError("Chave da API de IA não configurada. Adicione ANTHROPIC_API_KEY nas variáveis de ambiente da Vercel.");
        } else {
          setError(msg);
        }
        return;
      }

      const text: string = data.summary ?? "";
      setSummary(text);
      const now = new Date().toISOString();
      setGeneratedAt(now);
      if (activeWorkspaceId) saveCache(text, activeWorkspaceId);
    } catch (e: any) {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const fmtTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch { return ""; }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" /> Resumo IA
        </h2>
        {summary && !loading && (
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

      {loading && (
        <div className="flex flex-col items-center gap-3 py-6 text-muted-foreground">
          <div className="h-7 w-7 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
          <p className="text-xs">Gerando resumo com IA…</p>
        </div>
      )}

      {!loading && !summary && !error && (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <p className="text-xs text-muted-foreground">
            A IA analisa todas as demandas do workspace e gera um resumo executivo do que está acontecendo.
          </p>
          <button
            onClick={generate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/15 text-violet-700 hover:bg-violet-500/25 border border-violet-300/60 text-sm font-semibold transition-all active:scale-95"
          >
            <Sparkles className="h-4 w-4" /> Gerar resumo
          </button>
        </div>
      )}

      {!loading && summary && (
        <div className="space-y-2">
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{summary}</p>
          {generatedAt && (
            <p className="text-[10px] text-muted-foreground">Gerado em {fmtTime(generatedAt)}</p>
          )}
        </div>
      )}
    </div>
  );
}
