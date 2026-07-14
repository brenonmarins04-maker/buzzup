import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { hasStoredRecoverySession } from "@/lib/recoverySession";
import {
  isTransientAuthError,
  loadAuthHubSnapshot,
  type HubRpcClient,
} from "@/lib/authHub";

export type WorkspaceRole = "owner" | "admin" | "leader" | "member";
export type MyWorkspace = { workspace_id: string; name: string; code: string; role: WorkspaceRole; created_at: string };
export type MyTrashedWorkspace = { workspace_id: string; name: string; code: string; deleted_at: string; delete_after: string };
export type MyJoinRequest = { id: string; workspace_id: string; workspace_name: string; workspace_code: string; status: "pending"|"approved"|"rejected"|"canceled"; requested_at: string; decided_at: string | null; decided_role: string | null };
export type HubStatus = "idle" | "loading" | "ready" | "error";

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
  trashedWorkspaces: MyTrashedWorkspace[];
  myJoinRequests: MyJoinRequest[];
  hubStatus: HubStatus;
  hubError: string | null;
  refreshHub: () => Promise<boolean>;
  isAdmin: boolean;
  isOwner: boolean;
  isLeader: boolean;
  refreshMembership: () => Promise<void>;
  requestJoinWorkspace: (code: string) => Promise<{ ok: boolean; error?: string }>;
  cancelJoinRequest: (reqId: string) => Promise<{ ok: boolean; error?: string }>;
  createWorkspace: (name: string) => Promise<{ ok: boolean; error?: string; workspace?: { id: string; name: string; code: string } }>;
  trashWorkspace: (workspaceId: string) => Promise<{ ok: boolean; error?: string }>;
  restoreWorkspace: (workspaceId: string) => Promise<{ ok: boolean; error?: string }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null; needsConfirmation?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
  resendConfirmation: (email: string) => Promise<{ error: Error | null }>;
  isRecovering: boolean;
  endRecovery: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

const ACTIVE_WS_KEY = "buzzup.activeWorkspaceId";
type UntypedRpcResult = {
  data: unknown;
  error: { message: string } | null;
};
type UntypedRpc = (
  name: string,
  args?: Record<string, unknown>,
) => PromiseLike<UntypedRpcResult>;
const untypedRpc = supabase.rpc as unknown as UntypedRpc;
const authHubClient: HubRpcClient = {
  rpc: (name) => untypedRpc(name),
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  // Fluxo de recuperação de senha: capturado de forma síncrona no primeiro
  // render (antes do client do Supabase limpar o hash da URL). Enquanto true,
  // o app força a tela /reset-password e NÃO leva o usuário para o workspace.
  const [isRecovering, setIsRecovering] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const hash = window.location.hash || "";
    const query = window.location.search || "";
    return hash.includes("type=recovery") ||
      new URLSearchParams(query).get("type") === "recovery" ||
      hasStoredRecoverySession();
  });
  const currentUserIdRef = useRef<string | null>(null);
  const [myWorkspaces, setMyWorkspaces] = useState<MyWorkspace[]>([]);
  const [trashedWorkspaces, setTrashedWorkspaces] = useState<MyTrashedWorkspace[]>([]);
  const [myJoinRequests, setMyJoinRequests] = useState<MyJoinRequest[]>([]);
  const [hubStatus, setHubStatus] = useState<HubStatus>("idle");
  const [hubError, setHubError] = useState<string | null>(null);
  // Used to detect status transitions and fire toasts
  const prevJoinRequestsRef = useRef<MyJoinRequest[]>([]);
  const hubLoadedRef = useRef(false);
  const hubRequestIdRef = useRef(0);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(() => {
    try { return localStorage.getItem(ACTIVE_WS_KEY); } catch { return null; }
  });

  const setActiveWorkspaceId = (id: string | null) => {
    setActiveWorkspaceIdState(id);
    try {
      if (id) localStorage.setItem(ACTIVE_WS_KEY, id);
      else localStorage.removeItem(ACTIVE_WS_KEY);
    } catch {
      // Some mobile privacy modes block browser storage; React state still works.
    }
  };

  async function fetchHub(expectedUserId = currentUserIdRef.current): Promise<boolean> {
    if (!expectedUserId) return false;

    const requestId = hubRequestIdRef.current;
    if (!hubLoadedRef.current) setHubStatus("loading");
    setHubError(null);

    // Sessões recém-criadas (link de confirmação, login logo após confirmar)
    // podem demorar alguns instantes para o client persistir — tenta algumas
    // vezes antes de acusar sessão inválida, senão conta nova vê erro à toa.
    let sessionValid = false;
    for (let attempt = 0; attempt < 8; attempt++) {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (
        requestId !== hubRequestIdRef.current
        || currentUserIdRef.current !== expectedUserId
      ) return false;
      if (!sessionError && sessionData.session?.user.id === expectedUserId) {
        sessionValid = true;
        break;
      }
      await new Promise(r => setTimeout(r, 250));
    }
    if (
      requestId !== hubRequestIdRef.current
      || currentUserIdRef.current !== expectedUserId
    ) return false;

    if (!sessionValid) {
      if (!hubLoadedRef.current) setHubStatus("error");
      setHubError("Sua sessão não pôde ser validada. Tente carregar novamente.");
      return false;
    }

    const result = await loadAuthHubSnapshot(authHubClient);
    if (
      requestId !== hubRequestIdRef.current
      || currentUserIdRef.current !== expectedUserId
    ) return false;

    if (!result.ok) {
      if (!hubLoadedRef.current) setHubStatus("error");
      setHubError("Não foi possível carregar seus workspaces. Sua conta e seus dados continuam intactos.");
      return false;
    }

    const ws = result.snapshot.workspaces as MyWorkspace[];
    const trash = result.snapshot.trashedWorkspaces as MyTrashedWorkspace[];
    const newRequests = result.snapshot.joinRequests as MyJoinRequest[];

    // Replace the visible list only after an authenticated query succeeds.
    // A failed request must never look like a real account with zero workspaces.
    setMyWorkspaces(ws);
    setActiveWorkspaceIdState(prev => {
      if (prev && ws.find(w => w.workspace_id === prev)) return prev;
      const next = ws[0]?.workspace_id ?? null;
      try {
        if (next) localStorage.setItem(ACTIVE_WS_KEY, next);
        else localStorage.removeItem(ACTIVE_WS_KEY);
      } catch {
        // Keep the authenticated list usable even when browser storage is blocked.
      }
      return next;
    });

    if (!result.snapshot.trashError) {
      setTrashedWorkspaces(trash);
    }

    // Detect status transitions after the first successful load
    if (!result.snapshot.joinRequestsError) {
      if (hubLoadedRef.current) {
        newRequests.forEach(nr => {
          const prev = prevJoinRequestsRef.current.find(r => r.id === nr.id);
          if (prev?.status === "pending") {
            if (nr.status === "approved") {
              toast.success(`Entrada aprovada em "${nr.workspace_name}"! 🎉`, {
                description: "Você já pode acessar o workspace.",
                duration: 6000,
              });
            } else if (nr.status === "rejected") {
              toast.error(`Pedido recusado para "${nr.workspace_name}".`, {
                description: "O owner não aprovou sua entrada.",
                duration: 6000,
              });
            }
          }
        });
      }
      prevJoinRequestsRef.current = newRequests;
      setMyJoinRequests(newRequests);
    }

    hubLoadedRef.current = true;
    setHubStatus("ready");
    setHubError(null);
    return true;
  }

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === "PASSWORD_RECOVERY") setIsRecovering(true);
      const previousUserId = currentUserIdRef.current;
      setSession(session);
      setUser(session?.user ?? null);
      currentUserIdRef.current = session?.user?.id ?? null;
      if (session?.user) {
        if (previousUserId !== session.user.id) {
          hubRequestIdRef.current += 1;
          hubLoadedRef.current = false;
          setMyWorkspaces([]);
          setTrashedWorkspaces([]);
          setMyJoinRequests([]);
          setHubStatus("loading");
          setHubError(null);
        }
        setDisplayName(session.user.email ? session.user.email.split("@")[0] : "Usuário");
        setTimeout(async () => {
          fetchDisplayName(session.user.id);
          void fetchHub(session.user.id);
        }, 0);
      } else {
        hubRequestIdRef.current += 1;
        setDisplayName("");
        setMyWorkspaces([]);
        setTrashedWorkspaces([]);
        setMyJoinRequests([]);
        setActiveWorkspaceId(null);
        prevJoinRequestsRef.current = [];
        hubLoadedRef.current = false;
        setHubStatus("idle");
        setHubError(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      const previousUserId = currentUserIdRef.current;
      setSession(session);
      setUser(session?.user ?? null);
      currentUserIdRef.current = session?.user?.id ?? null;
      if (session?.user) {
        if (previousUserId !== session.user.id) {
          hubLoadedRef.current = false;
          setHubStatus("loading");
          setHubError(null);
        }
        setDisplayName(session.user.email ? session.user.email.split("@")[0] : "Usuário");
        (async () => {
          fetchDisplayName(session.user.id);
          void fetchHub(session.user.id);
        })();
      } else {
        setHubStatus("idle");
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Realtime: re-fetch hub when memberships or join requests change for this user
  const realtimeUserId = user?.id;
  useEffect(() => {
    if (!realtimeUserId) return;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    try {
      ch = supabase
        .channel(`hub-${realtimeUserId}-${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "workspace_members", filter: `user_id=eq.${realtimeUserId}` }, () => fetchHub())
        .on("postgres_changes", { event: "*", schema: "public", table: "workspace_join_requests", filter: `user_id=eq.${realtimeUserId}` }, () => fetchHub())
        .subscribe();
    } catch { ch = null; }
    return () => { if (ch) supabase.removeChannel(ch); };
  }, [realtimeUserId]);

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
    const metadata = authUser?.user_metadata as Record<string, unknown> | undefined;
    const metaName = typeof metadata?.display_name === "string"
      ? metadata.display_name.trim()
      : undefined;
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
    const normalizedEmail = email.trim().toLowerCase();
    // Cadastro nativo do Supabase: com "Confirm email" ativo no projeto, o
    // usuário recebe o link de confirmação (remetente/template configurados
    // no painel — ver email-setup-buzzup.md) e só entra depois de confirmar.
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { display_name: name || normalizedEmail.split("@")[0] },
        // O link do e-mail abre a página "E-mail confirmado" (não entra direto
        // no app) — de lá a pessoa vai ao login ou volta ao outro dispositivo.
        emailRedirectTo: `${window.location.origin}/email-confirmado`,
      },
    });
    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("already registered") || msg.includes("already exists")) {
        return { error: new Error("Este e-mail já está cadastrado. Tente fazer login.") };
      }
      return { error: error as Error };
    }
    // Com confirmação ativa, e-mail repetido volta um usuário "fantasma" sem
    // identities — tratamos como conta existente em vez de reenviar o e-mail.
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      return { error: new Error("Este e-mail já está cadastrado. Tente fazer login.") };
    }
    // Sem sessão = precisa confirmar o e-mail antes de entrar
    return { error: null, needsConfirmation: !data.session };
  };

  const resendConfirmation = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/email-confirmado` },
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const credentials = { email: email.trim().toLowerCase(), password };
    let data: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>["data"] = {
      user: null,
      session: null,
    };
    let error: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>["error"] = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await supabase.auth.signInWithPassword(credentials);
      data = response.data;
      error = response.error;
      if (!error || !isTransientAuthError(error) || attempt === 2) break;
      await new Promise(resolve => window.setTimeout(resolve, attempt === 0 ? 300 : 900));
    }

    if (!error && data.session) {
      const signedInUser = data.session.user;
      setSession(data.session);
      setUser(signedInUser);
      currentUserIdRef.current = signedInUser.id;
      setDisplayName(signedInUser.email ? signedInUser.email.split("@")[0] : "Usuário");
      void fetchDisplayName(signedInUser.id);
      await fetchHub(signedInUser.id);
    }
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
    const { data: { session: recoverySession } } = await supabase.auth.getSession();
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) return { error: null };

    const authError = error as Error & { code?: string };
    const isSamePassword =
      authError.code === "same_password" ||
      authError.message.toLowerCase().includes("different from the old password");
    if (!isSamePassword || !recoverySession?.access_token) {
      return { error: authError };
    }

    try {
      const response = await fetch("/api/reset-password", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${recoverySession.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        return { error: new Error("Não foi possível regravar a senha atual.") };
      }
      return { error: null };
    } catch {
      return { error: new Error("Não foi possível conectar ao serviço de redefinição.") };
    }
  };

  // Encerra o fluxo de recuperação: desloga a sessão temporária do link e
  // limpa a flag, para o usuário fazer login normalmente com a senha nova.
  const endRecovery = async () => {
    setIsRecovering(false);
    setActiveWorkspaceId(null);
    await supabase.auth.signOut({ scope: "local" });
    setSession(null);
    setUser(null);
    currentUserIdRef.current = null;
  };

  const refreshMembership = async () => { await fetchHub(); };
  const refreshHub = async () => fetchHub();

  const requestJoinWorkspace = async (code: string) => {
    const trimmedCode = code.trim().toUpperCase();

    const { error } = await supabase.rpc("request_join_workspace", { _code: trimmedCode });
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
    const { error } = await supabase.rpc("cancel_join_request", { _req_id: reqId });
    if (error) return { ok: false, error: error.message };
    await fetchHub();
    return { ok: true };
  };

  const createWorkspace = async (name: string) => {
    const { data, error } = await supabase.rpc("create_workspace", { _name: name });
    if (error) return { ok: false, error: error.message };
    const ws = Array.isArray(data) ? data[0] : data;

    // Grava os nomes padrão das áreas como broadcast para que todos os membros
    // vejam Geral / Marketing / Financeiro / Eventos / Projetos ao entrar.
    if (ws?.id) {
      const defaultAreaNames = {
        projetos:   "Geral",
        mercado:    "Marketing",
        gg:         "Financeiro",
        presidencia:"Eventos / Projetos",
      };
      const expiresAt = new Date(Date.now() + 36500 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from("broadcasts").insert({
        workspace_id: ws.id,
        message: `__AREA_NAMES__:${JSON.stringify(defaultAreaNames)}`,
        duration_days: 36500,
        expires_at: expiresAt,
      });
    }

    await fetchHub();
    if (ws?.id) setActiveWorkspaceId(ws.id);
    return { ok: true, workspace: ws ? { id: ws.id, name: ws.name, code: ws.code } : undefined };
  };

  const trashWorkspace = async (workspaceId: string) => {
    const { error } = await untypedRpc("trash_workspace", { _ws_id: workspaceId });
    if (error) return { ok: false, error: error.message };
    if (activeWorkspaceId === workspaceId) setActiveWorkspaceId(null);
    await fetchHub();
    return { ok: true };
  };

  const restoreWorkspace = async (workspaceId: string) => {
    const { error } = await untypedRpc("restore_workspace", { _ws_id: workspaceId });
    if (error) return { ok: false, error: error.message };
    await fetchHub();
    return { ok: true };
  };

  const activeWs = myWorkspaces.find(w => w.workspace_id === activeWorkspaceId) || null;
  const role = activeWs?.role ?? null;
  const workspaceId = activeWorkspaceId;

  return (
    <AuthContext.Provider value={{
      user, session, loading, displayName, role, workspaceId,
      activeWorkspaceId, setActiveWorkspaceId,
      myWorkspaces, trashedWorkspaces, myJoinRequests, hubStatus, hubError, refreshHub,
      isAdmin: role === "admin" || role === "owner",
      isOwner: role === "owner",
      isLeader: role === "leader",
      refreshMembership, requestJoinWorkspace, cancelJoinRequest, createWorkspace, trashWorkspace, restoreWorkspace,
      signUp, signIn, signOut, resetPassword, updatePassword, resendConfirmation,
      isRecovering, endRecovery,
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
