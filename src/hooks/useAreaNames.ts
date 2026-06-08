import { useEffect, useCallback, useState } from "react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  setCustomAreaNames,
  getCustomAreaNames,
  loadAreaNamesForWorkspace,
  AREAS_DEFAULT,
} from "@/lib/areas";

const AREA_NAMES_PREFIX = "__AREA_NAMES__:";

export function useAreaNames() {
  const { broadcasts, addBroadcast, deleteBroadcast } = useData() as any;
  const { activeWorkspaceId } = useAuth();
  // version bumps force consumers to re-render when names change
  const [version, setVersion] = useState(0);

  // Load workspace-specific names from localStorage whenever workspace changes
  useEffect(() => {
    loadAreaNamesForWorkspace(activeWorkspaceId ?? null);
    setVersion(v => v + 1);
  }, [activeWorkspaceId]);

  // Sync from broadcasts (workspace-scoped via DataContext) into per-workspace cache
  useEffect(() => {
    if (!broadcasts || !activeWorkspaceId) return;
    const flag = (broadcasts as any[]).find((b: any) =>
      b.message?.startsWith(AREA_NAMES_PREFIX)
    );
    if (flag) {
      try {
        const names = JSON.parse(flag.message.slice(AREA_NAMES_PREFIX.length));
        setCustomAreaNames(names, activeWorkspaceId);
        setVersion(v => v + 1);
      } catch {}
    } else {
      // No custom broadcast → use defaults (clear any cached names for this ws)
      // Only clear if we already loaded this workspace (don't wipe on first load)
      setCustomAreaNames({}, activeWorkspaceId);
      setVersion(v => v + 1);
    }
  }, [broadcasts, activeWorkspaceId]);

  const saveAreaNames = useCallback(
    async (names: Record<string, string>) => {
      if (!activeWorkspaceId) return;

      // Apply locally immediately (workspace-specific)
      setCustomAreaNames(names, activeWorkspaceId);
      setVersion(v => v + 1);

      // Remove old broadcast for this workspace, create new one
      if (broadcasts) {
        const old = (broadcasts as any[]).find((b: any) =>
          b.message?.startsWith(AREA_NAMES_PREFIX)
        );
        if (old) await deleteBroadcast(old.id);
      }
      const expiresAt = new Date(
        Date.now() + 36500 * 24 * 60 * 60 * 1000
      ).toISOString();
      await addBroadcast(`${AREA_NAMES_PREFIX}${JSON.stringify(names)}`, 36500);
    },
    [broadcasts, addBroadcast, deleteBroadcast, activeWorkspaceId]
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
