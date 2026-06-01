import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export type WorkspaceRole = "owner" | "admin" | "leader" | "member";
export type MyWorkspace = { workspace_id: string; name: string; code: string; role: WorkspaceRole; created_at: string };
export type MyJoinRequest = { id: string; workspace_id: string; workspace_name: string; workspace_code: string; status: "pending"|"approved"|"rejected"|"canceled"; requested_at: string; decided_at: string | null; decided_role: string | null };

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  displayName: string;
  role: WorkspaceRole | null;
  workspaceId: string | null;
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string | null) => void;
  myWorkspaces: MyWorkspace[];
  myJoinRequests: MyJoinRequest[];
  refreshHub: () => Promise<void>;
  isAdmin: boolean;
  isOwner: boolean;
  isLeader: boolean;
  refreshMembership: () => Promise<void>;
  requestJoinWorkspace: (code: string) => Promise<{ ok: boolean; error?: string }>;
  cancelJoinRequest: (reqId: string) => Promise<{ ok: boolean; error?: string }>;
  createWorkspace: (name: string) => Promise<{ ok: boolean; error?: string; workspace?: { id: string; name: string; code: string } }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
};

const AuthContext = createContext<AuthContextType | null>(null);

const ACTIVE_WS_KEY = "buzzup.activeWorkspaceId";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const currentUserIdRef = useRef<string | null>(null);
  const [myWorkspaces, setMyWorkspaces] = useState<MyWorkspace[]>([]);
  const [myJoinRequests, setMyJoinRequests] = useState<MyJoinRequest[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(() => {
    try { return localStorage.getItem(ACTIVE_WS_KEY); } catch { return null; }
  });

  const setActiveWorkspaceId = (id: string | null) => {
    setActiveWorkspaceIdState(id);
    try {
      if (id) localStorage.setItem(ACTIVE_WS_KEY, id);
      else localStorage.removeItem(ACTIVE_WS_KEY);
    } catch {}
  };

  async function fetchHub() {
    const [wsRes, reqRes] = await Promise.all([
      (supabase.rpc as any)("list_my_workspaces"),
      (supabase.rpc as any)("list_my_join_requests"),
    ]);
    const ws: MyWorkspace[] = (wsRes.data as any[] | null) || [];
    setMyWorkspaces(ws);
    setMyJoinRequests(((reqRes.data as any[] | null) || []) as MyJoinRequest[]);
    setActiveWorkspaceIdState(prev => {
      if (prev && ws.find(w => w.workspace_id === prev)) return prev;
      const next = ws[0]?.workspace_id ?? null;
      try {
        if (next) localStorage.setItem(ACTIVE_WS_KEY, next);
        else localStorage.removeItem(ACTIVE_WS_KEY);
      } catch {}
      return next;
    });
  }

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      currentUserIdRef.current = session?.user?.id ?? null;
      if (session?.user) {
        setDisplayName(session.user.email ? session.user.email.split("@")[0] : "Usuário");
        setTimeout(async () => {
          fetchDisplayName(session.user.id);
          fetchHub();
        }, 0);
      } else {
        setDisplayName("");
        setMyWorkspaces([]);
        setMyJoinRequests([]);
        setActiveWorkspaceId(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      currentUserIdRef.current = session?.user?.id ?? null;
      if (session?.user) {
        setDisplayName(session.user.email ? session.user.email.split("@")[0] : "Usuário");
        (async () => {
          fetchDisplayName(session.user.id);
          fetchHub();
        })();
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Realtime: re-fetch hub when memberships or join requests change for this user
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`hub-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "workspace_members", filter: `user_id=eq.${user.id}` }, () => fetchHub())
      .on("postgres_changes", { event: "*", schema: "public", table: "workspace_join_requests", filter: `user_id=eq.${user.id}` }, () => fetchHub())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  async function fetchDisplayName(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("display_name, email")
      .eq("user_id", userId)
      .maybeSingle();
    if (data && data.display_name && data.display_name.trim()) {
      if (currentUserIdRef.current === userId) setDisplayName(data.display_name.trim());
      return;
    }
    // No profile row yet — create one from signup metadata when it looks valid,
    // otherwise fall back to the email prefix so stale placeholders like "teste" don't appear.
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const metaName = ((authUser?.user_metadata as any)?.display_name as string | undefined)?.trim();
    const email = authUser?.email || "";
    const isPlaceholderName = !!metaName && /^(teste|test|usu[aá]rio|user)$/i.test(metaName);
    const finalName = metaName && !isPlaceholderName ? metaName : (email ? email.split("@")[0] : "Usuário");
    await supabase.from("profiles").upsert(
      { user_id: userId, display_name: finalName, email },
      { onConflict: "user_id" }
    );
    if (currentUserIdRef.current === userId) setDisplayName(finalName);
  }

  const signUp = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name },
        emailRedirectTo: window.location.origin,
      },
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    setActiveWorkspaceId(null);
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error as Error | null };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error as Error | null };
  };

  const refreshMembership = async () => { await fetchHub(); };
  const refreshHub = async () => { await fetchHub(); };

  const requestJoinWorkspace = async (code: string) => {
    const { error } = await (supabase.rpc as any)("request_join_workspace", { _code: code.trim().toUpperCase() });
    if (error) {
      const msg = String(error.message || "").toLowerCase();
      if (msg.includes("already_member")) return { ok: false, error: "Você já pertence a este workspace." };
      if (msg.includes("already_pending")) return { ok: false, error: "Você já tem um pedido pendente para esse workspace." };
      if (msg.includes("invalid_code")) return { ok: false, error: "Código inválido. Confirme com o owner." };
      if (msg.includes("not_authenticated")) return { ok: false, error: "Faça login para pedir entrada." };
      return { ok: false, error: "Não foi possível pedir entrada." };
    }
    await fetchHub();
    return { ok: true };
  };

  const cancelJoinRequest = async (reqId: string) => {
    const { error } = await (supabase.rpc as any)("cancel_join_request", { _req_id: reqId });
    if (error) return { ok: false, error: error.message };
    await fetchHub();
    return { ok: true };
  };

  const createWorkspace = async (name: string) => {
    const { data, error } = await (supabase.rpc as any)("create_workspace", { _name: name });
    if (error) return { ok: false, error: error.message };
    const ws = Array.isArray(data) ? data[0] : data;
    await fetchHub();
    if (ws?.id) setActiveWorkspaceId(ws.id);
    return { ok: true, workspace: ws ? { id: ws.id, name: ws.name, code: ws.code } : undefined };
  };

  const activeWs = myWorkspaces.find(w => w.workspace_id === activeWorkspaceId) || null;
  const role = activeWs?.role ?? null;
  const workspaceId = activeWorkspaceId;

  return (
    <AuthContext.Provider value={{
      user, session, loading, displayName, role, workspaceId,
      activeWorkspaceId, setActiveWorkspaceId,
      myWorkspaces, myJoinRequests, refreshHub,
      isAdmin: role === "admin" || role === "owner",
      isOwner: role === "owner",
      isLeader: role === "leader",
      refreshMembership, requestJoinWorkspace, cancelJoinRequest, createWorkspace,
      signUp, signIn, signOut, resetPassword, updatePassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
