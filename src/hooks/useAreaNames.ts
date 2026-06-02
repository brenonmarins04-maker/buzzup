import { useEffect, useCallback } from "react";
import { useData } from "@/contexts/DataContext";
import { setCustomAreaNames, getCustomAreaNames, AREAS_DEFAULT } from "@/lib/areas";

const AREA_NAMES_BROADCAST_PREFIX = "__AREA_NAMES__:";

export function useAreaNames() {
  const { broadcasts, addBroadcast, deleteBroadcast } = useData() as any;

  // Sync from broadcasts to local state on load
  useEffect(() => {
    if (!broadcasts) return;
    const flag = (broadcasts as any[]).find((b: any) => b.message?.startsWith(AREA_NAMES_BROADCAST_PREFIX));
    if (flag) {
      try {
        const json = flag.message.slice(AREA_NAMES_BROADCAST_PREFIX.length);
        const names = JSON.parse(json);
        setCustomAreaNames(names);
      } catch {}
    }
  }, [broadcasts]);

  const saveAreaNames = useCallback(async (names: Record<string, string>) => {
    // Update local immediately
    setCustomAreaNames(names);

    // Remove old broadcast flag
    if (broadcasts) {
      const old = (broadcasts as any[]).find((b: any) => b.message?.startsWith(AREA_NAMES_BROADCAST_PREFIX));
      if (old) await deleteBroadcast(old.id);
    }

    // Create new broadcast with names
    const json = JSON.stringify(names);
    await addBroadcast(`${AREA_NAMES_BROADCAST_PREFIX}${json}`, 36500);
  }, [broadcasts, addBroadcast, deleteBroadcast]);

  const currentNames = getCustomAreaNames();
  const areaNames = AREAS_DEFAULT.map(a => ({
    key: a.key,
    defaultLabel: a.label,
    currentLabel: currentNames[a.key] || a.label,
    color: a.color,
  }));

  return { areaNames, saveAreaNames, currentNames };
}
