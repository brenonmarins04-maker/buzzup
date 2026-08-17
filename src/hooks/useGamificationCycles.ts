import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  EMPTY_CYCLES,
  findActiveCycle,
  makeCycleId,
  normalizeCycles,
  type CyclesState,
  type GamificationCycle,
} from "@/lib/gamificationCycles";

type SaveResult = { ok: boolean; error?: string };

/**
 * Ciclos de gamificação do workspace ativo.
 * Leitura: todos os membros (o ciclo ativo vale para a empresa inteira).
 * Escrita: diretores/owner — validado no banco.
 */
export function useGamificationCycles() {
  const { activeWorkspaceId, isAdmin } = useAuth();
  const [state, setState] = useState<CyclesState>(EMPTY_CYCLES);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setState(EMPTY_CYCLES);
    setLoaded(false);
    if (!activeWorkspaceId) return;

    const wsId = activeWorkspaceId;
    let cancelled = false;

    const load = async () => {
      const { data, error } = await (supabase.from("workspace_config") as any)
        .select("gamification_cycles")
        .eq("workspace_id", wsId)
        .maybeSingle();
      if (cancelled) return;
      // Sem linha ou sem a coluna (SQL ainda não rodou): segue sem ciclos
      if (!error && data?.gamification_cycles) {
        setState(normalizeCycles(data.gamification_cycles));
      }
      setLoaded(true);
    };
    load();

    // Realtime: o ciclo escolhido pelo diretor chega para todo mundo na hora
    let ch: ReturnType<typeof supabase.channel> | null = null;
    try {
      ch = supabase
        .channel(`wsgc-${wsId}-${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", {
          event: "*", schema: "public", table: "workspace_config",
          filter: `workspace_id=eq.${wsId}`,
        }, () => { if (!cancelled) load(); })
        .subscribe();
    } catch { ch = null; }

    return () => { cancelled = true; if (ch) supabase.removeChannel(ch); };
  }, [activeWorkspaceId]);

  const persist = useCallback(async (next: CyclesState): Promise<SaveResult> => {
    if (!activeWorkspaceId) return { ok: false, error: "Workspace não encontrado." };
    if (!isAdmin) return { ok: false, error: "Só diretores podem gerenciar ciclos." };

    const previous = state;
    setState(next); // otimista

    const { data, error } = await (supabase.rpc as any)("set_gamification_cycles", {
      _ws_id: activeWorkspaceId,
      _payload: next,
    });

    if (error) {
      setState(previous);
      const msg = String(error.message || "").toLowerCase();
      if (msg.includes("not_allowed")) return { ok: false, error: "Só diretores podem gerenciar ciclos." };
      if (msg.includes("too_many")) return { ok: false, error: "Limite de ciclos atingido." };
      if (msg.includes("could not find") || msg.includes("does not exist")) {
        return { ok: false, error: "Rode o gamification-cycles-setup.sql no Supabase para ativar os ciclos." };
      }
      return { ok: false, error: "Não foi possível salvar o ciclo." };
    }

    if (data) setState(normalizeCycles(data));
    return { ok: true };
  }, [activeWorkspaceId, isAdmin, state]);

  const addCycle = useCallback(
    (name: string, start: string, end: string) => {
      const cycle: GamificationCycle = {
        id: makeCycleId(),
        name: name.trim() || `Ciclo ${state.cycles.length + 1}`,
        start,
        end: end || "",
      };
      // Criar já deixa o novo ciclo ativo
      return persist({ cycles: [cycle, ...state.cycles], activeId: cycle.id });
    },
    [persist, state],
  );

  const removeCycle = useCallback(
    (id: string) => persist({
      cycles: state.cycles.filter(c => c.id !== id),
      activeId: state.activeId === id ? null : state.activeId,
    }),
    [persist, state],
  );

  /** null = "Desde o início" (conta todos os pontos) */
  const setActiveCycle = useCallback(
    (id: string | null) => persist({ ...state, activeId: id }),
    [persist, state],
  );

  return {
    cycles: state.cycles,
    activeCycle: findActiveCycle(state),
    activeId: state.activeId,
    loaded,
    canManage: isAdmin,
    addCycle,
    removeCycle,
    setActiveCycle,
  };
}
