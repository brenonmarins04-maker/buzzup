import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  DEFAULT_DEMAND_POINTS,
  getDemandPoints,
  loadDemandPointsForWorkspace,
  normalizeDemandPoints,
  setDemandPointsCache,
} from "@/lib/demandPoints";

/**
 * Valores rápidos de pontuação das demandas do workspace ativo.
 * Leitura: qualquer membro. Escrita: diretores/owner (validado no banco).
 */
export function useDemandPoints() {
  const { activeWorkspaceId, isAdmin } = useAuth();
  const [points, setPoints] = useState<number[]>(() =>
    getDemandPoints(activeWorkspaceId ?? undefined),
  );

  useEffect(() => {
    loadDemandPointsForWorkspace(activeWorkspaceId ?? null);
    setPoints(getDemandPoints(activeWorkspaceId ?? undefined));
    if (!activeWorkspaceId) return;

    const wsId = activeWorkspaceId;
    let cancelled = false;

    const load = async () => {
      const { data, error } = await (supabase.from("workspace_config") as any)
        .select("demand_points")
        .eq("workspace_id", wsId)
        .maybeSingle();
      if (cancelled) return;
      // Sem linha ou sem a coluna (SQL ainda não rodou): mantém o padrão
      if (error || !data?.demand_points) return;
      setPoints(setDemandPointsCache(data.demand_points, wsId));
    };
    load();

    // Realtime: todos veem a mudança do diretor na hora
    let ch: ReturnType<typeof supabase.channel> | null = null;
    try {
      ch = supabase
        .channel(`wsdp-${wsId}-${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", {
          event: "*", schema: "public", table: "workspace_config",
          filter: `workspace_id=eq.${wsId}`,
        }, () => { if (!cancelled) load(); })
        .subscribe();
    } catch { ch = null; }

    return () => { cancelled = true; if (ch) supabase.removeChannel(ch); };
  }, [activeWorkspaceId]);

  const savePoints = useCallback(
    async (next: number[]): Promise<{ ok: boolean; error?: string }> => {
      if (!activeWorkspaceId) return { ok: false, error: "Workspace não encontrado." };
      if (!isAdmin) return { ok: false, error: "Só diretores podem alterar a pontuação." };

      const clean = normalizeDemandPoints(next);
      const { data, error } = await (supabase.rpc as any)("set_demand_points", {
        _ws_id: activeWorkspaceId,
        _points: clean,
      });

      if (error) {
        const msg = String(error.message || "").toLowerCase();
        if (msg.includes("not_allowed")) return { ok: false, error: "Só diretores podem alterar a pontuação." };
        if (msg.includes("invalid_points")) return { ok: false, error: "Escolha ao menos um valor de pontos." };
        if (msg.includes("could not find") || msg.includes("does not exist")) {
          return { ok: false, error: "Rode o gamification-points-config.sql no Supabase para ativar esta configuração." };
        }
        return { ok: false, error: "Não foi possível salvar a pontuação." };
      }

      setPoints(setDemandPointsCache(data ?? clean, activeWorkspaceId));
      return { ok: true };
    },
    [activeWorkspaceId, isAdmin],
  );

  return { points, savePoints, defaultPoints: DEFAULT_DEMAND_POINTS };
}
