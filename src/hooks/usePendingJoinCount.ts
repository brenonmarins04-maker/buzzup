import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Quantidade de pedidos de entrada pendentes nos workspaces onde o usuário é
// owner. Só conta (sem toasts — o AppLayout cuida das notificações).
export function usePendingJoinCount(): number {
  const { user, myWorkspaces } = useAuth();
  const [count, setCount] = useState(0);
  const ownedWorkspaceIds = myWorkspaces.filter(w => w.role === "owner").map(w => w.workspace_id);
  const ownedKey = ownedWorkspaceIds.join(",");

  useEffect(() => {
    if (!user || ownedWorkspaceIds.length === 0) { setCount(0); return; }
    let cancelled = false;

    const load = async () => {
      const { count: c } = await supabase
        .from("workspace_join_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .in("workspace_id", ownedWorkspaceIds)
        .neq("user_id", user.id);
      if (!cancelled) setCount(c || 0);
    };
    load();

    let ch: ReturnType<typeof supabase.channel> | null = null;
    try {
      ch = supabase
        .channel(`pending-joins-hook-${user.id}-${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "workspace_join_requests" }, () => load())
        .subscribe();
    } catch { ch = null; }

    return () => { cancelled = true; if (ch) supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, ownedKey]);

  return count;
}
