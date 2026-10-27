import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * A gamificação está ligada neste workspace?
 *
 * Nem toda empresa usa ranking e pontos. Desligar não apaga nada: os pontos,
 * as ações e o histórico continuam no banco, apenas somem da tela de todo
 * mundo. Religar devolve tudo como estava.
 *
 * Leitura: qualquer membro — o estado vale para o workspace inteiro.
 * Escrita: só o dono do workspace, validado no banco.
 */
export function useGamificationEnabled() {
  const { activeWorkspaceId, isOwner } = useAuth();
  // Começa ligada: é como todos os workspaces funcionavam até agora, e um
  // erro de leitura não pode esconder a gamificação de quem usa.
  const [enabled, setEnabled] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEnabled(true);
    setLoaded(false);
    if (!activeWorkspaceId) return;

    const wsId = activeWorkspaceId;
    let cancelled = false;

    const load = async () => {
      const { data, error } = await (supabase.from as any)("workspace_config")
        .select("gamification_enabled")
        .eq("workspace_id", wsId)
        .maybeSingle();
      if (cancelled) return;
      // Sem linha ou sem a coluna (SQL ainda não rodou): segue ligada
      if (!error && typeof data?.gamification_enabled === "boolean") {
        setEnabled(data.gamification_enabled);
      }
      setLoaded(true);
    };
    load();

    // Realtime: quando o dono desliga, as telas dos outros acompanham na hora
    let ch: ReturnType<typeof supabase.channel> | null = null;
    try {
      ch = supabase
        .channel(`wsge-${wsId}-${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", {
          event: "*", schema: "public", table: "workspace_config",
          filter: `workspace_id=eq.${wsId}`,
        }, () => { if (!cancelled) load(); })
        .subscribe();
    } catch { ch = null; }

    return () => { cancelled = true; if (ch) supabase.removeChannel(ch); };
  }, [activeWorkspaceId]);

  const alternar = useCallback(async (proximo: boolean): Promise<{ ok: boolean; error?: string }> => {
    if (!activeWorkspaceId) return { ok: false, error: "Workspace não encontrado." };
    if (!isOwner) return { ok: false, error: "Só o dono do workspace pode ligar ou desligar." };

    const anterior = enabled;
    setEnabled(proximo); // otimista: o botão responde no clique
    setSaving(true);

    const { data, error } = await (supabase.rpc as any)("set_gamification_enabled", {
      _ws_id: activeWorkspaceId,
      _enabled: proximo,
    });
    setSaving(false);

    if (error) {
      setEnabled(anterior);
      const msg = String(error.message || "").toLowerCase();
      if (msg.includes("not_owner")) {
        return { ok: false, error: "Só o dono do workspace pode ligar ou desligar." };
      }
      if (msg.includes("could not find") || msg.includes("does not exist") || msg.includes("schema cache")) {
        return { ok: false, error: "Rode o gamificacao-liga-desliga.sql no Supabase para ativar este botão." };
      }
      return { ok: false, error: "Não foi possível salvar." };
    }

    if (typeof data === "boolean") setEnabled(data);
    return { ok: true };
  }, [activeWorkspaceId, isOwner, enabled]);

  return { enabled, loaded, saving, canToggle: isOwner, alternar };
}
