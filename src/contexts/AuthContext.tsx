import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  displayName: string;
  role: "owner" | "admin" | "member" | null;
  workspaceId: string | null;
  isAdmin: boolean;
  isOwner: boolean;
  refreshMembership: () => Promise<void>;
  acceptInvite: (code: string) => Promise<{ ok: boolean; error?: string }>;
  createWorkspace: (name: string) => Promise<{ ok: boolean; error?: string }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"owner" | "admin" | "member" | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  async function fetchMembership(userId: string) {
    const { data: mem } = await supabase
      .from("workspace_members")
      .select("role, workspace_id, status")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .maybeSingle();
    if (!mem) { setRole(null); setWorkspaceId(null); return; }
    setRole(((mem.role as unknown) as "owner" | "admin" | "member") ?? "member");
    setWorkspaceId((mem as any).workspace_id ?? null);
  }

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(async () => {
          fetchDisplayName(session.user.id);
          fetchMembership(session.user.id);
        }, 0);
      } else {
        setDisplayName("");
        setRole(null);
        setWorkspaceId(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        (async () => {
          fetchDisplayName(session.user.id);
          fetchMembership(session.user.id);
        })();
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchDisplayName(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", userId)
      .single();
    if (data) setDisplayName(data.display_name || "");
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

  const refreshMembership = async () => {
    if (user) await fetchMembership(user.id);
  };

  const acceptInvite = async (code: string) => {
    const { error } = await (supabase.rpc as any)("accept_workspace_invite", { _code: code.trim().toUpperCase() });
    if (error) {
      const msg = String(error.message || "").toLowerCase();
      if (msg.includes("already_member")) return { ok: false, error: "Você já pertence a este workspace." };
      if (msg.includes("not_authenticated")) return { ok: false, error: "Faça login para usar o convite." };
      if (msg.includes("invalid_code")) return { ok: false, error: "Código inválido, expirado, já usado ou revogado." };
      return { ok: false, error: "Não foi possível entrar no workspace. Tente novamente." };
    }
    await refreshMembership();
    return { ok: true };
  };

  const createWorkspace = async (name: string) => {
    const { error } = await (supabase.rpc as any)("create_workspace", { _name: name });
    if (error) return { ok: false, error: error.message };
    await refreshMembership();
    return { ok: true };
  };

  return (
    <AuthContext.Provider value={{
      user, session, loading, displayName, role, workspaceId,
      isAdmin: role === "admin" || role === "owner",
      isOwner: role === "owner",
      refreshMembership, acceptInvite, createWorkspace,
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
