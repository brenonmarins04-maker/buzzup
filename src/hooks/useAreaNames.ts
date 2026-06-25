import { useEffect, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  setCustomAreaNames,
  getCustomAreaNames,
  loadAreaNamesForWorkspace,
  AREAS_DEFAULT,
} from "@/lib/areas";

const AREA_NAMES_PREFIX = "__AREA_NAMES__:";

export function useAreaNames() {
  const { activeWorkspaceId, isOwner } = useAuth();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    loadAreaNamesForWorkspace(activeWorkspaceId ?? null);
    if (!activeWorkspaceId) { setVersion(v => v + 1); return; }

    const wsId = activeWorkspaceId;
    let cancelled = false;

    const load = async () => {
      try {
        // Primary source: workspace_config table
        const { data: config, error } = await (supabase.from("workspace_config") as any)
          .select("area_names")
          .eq("workspace_id", wsId)
          .maybeSingle();

        if (cancelled) return;

        if (!error && config?.area_names) {
          setCustomAreaNames(config.area_names as Record<string, string>, wsId);
        } else {
          // Fallback: read from broadcasts (before SQL migration or if table doesn't exist yet)
          const { data: bcs } = await (supabase.from("broadcasts") as any)
            .select("message")
            .eq("workspace_id", wsId)
            .gt("expires_at", new Date().toISOString());

          if (!cancelled && bcs) {
            const flag = (bcs as any[]).find((b: any) => b.message?.startsWith(AREA_NAMES_PREFIX));
            if (flag) {
              try {
                const names = JSON.parse(flag.message.slice(AREA_NAMES_PREFIX.length));
                setCustomAreaNames(names, wsId);
              } catch {}
            }
          }
        }
      } catch {}
      if (!cancelled) setVersion(v => v + 1);
    };

    load();

    // Realtime: reload when the owner updates the config (so all members see it immediately)
    // Use a unique channel name per mount — supabase.channel(name) may return an already-subscribed
    // channel if the previous cleanup's removeChannel (async) hasn't finished yet, causing a throw.
    let ch: ReturnType<typeof supabase.channel> | null = null;
    try {
      ch = supabase
        .channel(`wsc-${wsId}-${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", {
          event: "*",
          schema: "public",
          table: "workspace_config",
          filter: `workspace_id=eq.${wsId}`,
        }, () => { if (!cancelled) load(); })
        .subscribe();
    } catch { /* realtime is non-essential; polling on mount is enough */ }

    return () => {
      cancelled = true;
      if (ch) supabase.removeChannel(ch);
    };
  }, [activeWorkspaceId]);

  const saveAreaNames = useCallback(
    async (names: Record<string, string>) => {
      if (!activeWorkspaceId || !isOwner) return;

      // Apply locally immediately
      setCustomAreaNames(names, activeWorkspaceId);
      setVersion(v => v + 1);

      // Persist to workspace_config (upsert: creates on first save, updates after)
      await (supabase.from("workspace_config") as any).upsert(
        {
          workspace_id: activeWorkspaceId,
          area_names: names,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id" }
      );
    },
    [activeWorkspaceId, isOwner]
  );

  const currentNames = getCustomAreaNames(activeWorkspaceId ?? undefined);
  const areaNames = AREAS_DEFAULT.map(a => ({
    key: a.key,
    defaultLabel: a.label,
    currentLabel: currentNames[a.key] || a.label,
    color: a.color,
  }));

  return { areaNames, saveAreaNames, currentNames, version };
}
