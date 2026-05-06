import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  displayName: string;
  role: "admin" | "viewer" | null;
  isAdmin: boolean;
  accessCode: string | null;
  refreshMembership: () => Promise<void>;
  redeemCode: (code: string) => Promise<{ ok: boolean; error?: string }>;
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
  const [role, setRole] = useState<"admin" | "viewer" | null>(null);
  const [accessCode, setAccessCode] = useState<string | null>(null);

  async function fetchMembership(userId: string) {
    const { data: mem } = await supabase
      .from("workspace_members")
      .select("role, workspace_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!mem) { setRole(null); setAccessCode(null); return; }
    setRole((mem.role as "admin" | "viewer") ?? "viewer");
    const { data: ws } = await supabase
      .from("workspaces")
      .select("access_code")
      .eq("id", mem.workspace_id)
      .maybeSingle();
    setAccessCode((ws as any)?.access_code ?? null);
  }

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Fetch display name deferred to avoid deadlock
        setTimeout(async () => {
          try { await (supabase.rpc as any)("demote_self_to_viewer"); } catch {}
          fetchDisplayName(session.user.id);
          fetchMembership(session.user.id);
        }, 0);
      } else {
        setDisplayName("");
        setRole(null);
        setAccessCode(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        (async () => {
          try { await (supabase.rpc as any)("demote_self_to_viewer"); } catch {}
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

  const redeemCode = async (code: string) => {
    const { data, error } = await (supabase.rpc as any)("redeem_access_code", { _code: code.trim().toUpperCase() });
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Código inválido" };
    await refreshMembership();
    return { ok: true };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, displayName, role, isAdmin: role === "admin", accessCode, refreshMembership, redeemCode, signUp, signIn, signOut, resetPassword, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
