import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Shield,
  LogOut,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Building2,
  Users,
  ListChecks,
  CheckCircle2,
  FileText,
  MousePointerClick,
  Link2,
  RefreshCw,
  Info,
  UserRound,
} from "lucide-react";
import NotFound from "./NotFound";

const GATE_HASH = "f87a1893847e119387bc0cf1c5d78cd69b142048b304e9723d2471df2d133ad5";

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Stats = {
  workspaces: number;
  usuarios: number;
  membros: number;
  pessoas: number;
  demandas: number;
  demandas_concluidas: number;
  formularios: number;
  entradas_registradas: number;
};

type WsRow = {
  id: string;
  name: string;
  code: string;
  created_at: string;
  owner_email: string | null;
  membros: number;
  demandas: number;
};

type UserRow = {
  user_id: string;
  display_name: string;
  email: string;
  created_at: string;
  workspaces: number;
  pessoas: number;
};

type DemandRow = {
  id: string;
  workspace_name: string;
  area: string;
  responsible_name: string;
  responsible_email: string | null;
  title: string;
  status: string;
  due_date: string;
  completed_at: string | null;
};

type LoginRow = {
  workspace_name: string;
  user_name: string;
  user_email: string;
  created_at: string;
};

type Funnel = {
  landing_views_total: number;
  landing_views_unique_sessions: number;
  signup_clicks_total: number;
  signup_clicks_unique_sessions: number;
  signup_success_total: number;
  signup_success_unique_users: number;
  workspace_entries_total: number;
  workspace_entries_unique_users: number;
  workspace_creations_total: number;
  workspace_join_requests_total: number;
};

type FunnelEventRow = {
  event_key: string;
  user_name: string;
  user_email: string;
  workspace_name: string;
  source: string;
  created_at: string;
};

type Phase = "checking" | "denied" | "gate" | "verifying" | "ok";
type DialogKey = "users" | "demands" | "logins" | null;

const eventLabel: Record<string, string> = {
  landing_view: "Abriu o link",
  signup_cta_click: "Clicou em criar conta",
  signup_success: "Criou conta",
  workspace_entered: "Entrou em workspace",
  workspace_created: "Criou workspace",
  workspace_join_requested: "Pediu entrada",
};

const metricExplanations = [
  {
    title: "Usuários",
    text: "Contas únicas criadas no BuzzUp. É o total de logins cadastrados na plataforma inteira.",
  },
  {
    title: "Membros ativos",
    text: "Vínculos de acesso dentro dos workspaces. Se a mesma pessoa participa de 2 workspaces, ela conta 2 vezes aqui.",
  },
  {
    title: "Pessoas cadastradas",
    text: "Registros operacionais usados nas demandas, gamificação, áreas e times. Normalmente acompanham os acessos, mas a lógica é de pessoa dentro do workspace.",
  },
];

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: string) {
  if (status === "done") return "Concluída";
  if (status === "in-progress") return "Em andamento";
  return status || "—";
}

function cleanEventText(value: string | null | undefined, fallback = "") {
  const text = (value || "").trim();
  if (!text) return fallback;
  return text
    .replaceAll("UsuÃ¡rio", "Usuário")
    .replaceAll("Ã¡", "á")
    .replaceAll("Ã©", "é")
    .replaceAll("Ã­", "í")
    .replaceAll("Ã³", "ó")
    .replaceAll("Ãº", "ú")
    .replaceAll("Ã£", "ã")
    .replaceAll("Ãµ", "õ")
    .replaceAll("Ã§", "ç");
}

function eventPersonLabel(event: FunnelEventRow) {
  const name = cleanEventText(event.user_name, "Visitante");
  if (name.toLowerCase().includes("usuário")) return "Visitante";
  return name;
}

export default function SecretAdminPage() {
  const { k } = useParams<{ k: string }>();
  const [phase, setPhase] = useState<Phase>("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [stats, setStats] = useState<Stats | null>(null);
  const [workspaces, setWorkspaces] = useState<WsRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [demands, setDemands] = useState<DemandRow[]>([]);
  const [globalLogins, setGlobalLogins] = useState<LoginRow[]>([]);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [funnelEvents, setFunnelEvents] = useState<FunnelEventRow[]>([]);
  const [portalUrl, setPortalUrl] = useState<string>("");
  const [loadingData, setLoadingData] = useState(false);
  const [openDialog, setOpenDialog] = useState<DialogKey>(null);

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!k) {
        setPhase("denied");
        return;
      }
      try {
        const hex = await sha256Hex(k);
        if (cancelled) return;
        if (hex !== GATE_HASH) {
          setPhase("denied");
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled) return;

        if (session) {
          const { data: isAdmin } = await (supabase.rpc as any)("is_platform_admin");
          if (cancelled) return;
          if (isAdmin === true) {
            setPhase("ok");
            return;
          }
        }

        setPhase("gate");
      } catch {
        if (!cancelled) setPhase("denied");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [k]);

  const loadData = async () => {
    setLoadingData(true);
    const [statsRes, wsRes, usersRes, demandsRes, loginsRes, funnelRes, funnelEventsRes, cfgRes] = await Promise.all([
      (supabase.rpc as any)("admin_platform_stats"),
      (supabase.rpc as any)("admin_list_workspaces"),
      (supabase.rpc as any)("admin_list_users"),
      (supabase.rpc as any)("admin_list_demands"),
      (supabase.rpc as any)("admin_list_global_logins", { _limit: 300 }),
      (supabase.rpc as any)("admin_platform_funnel"),
      (supabase.rpc as any)("admin_platform_funnel_events", { _limit: 300 }),
      (supabase.from("platform_admin_config") as any).select("value").eq("key", "admin_portal_url").maybeSingle(),
    ]);

    setStats((statsRes.data as Stats) ?? null);
    setWorkspaces((wsRes.data as WsRow[]) ?? []);
    setUsers((usersRes.data as UserRow[]) ?? []);
    setDemands((demandsRes.data as DemandRow[]) ?? []);
    setGlobalLogins((loginsRes.data as LoginRow[]) ?? []);
    setFunnel((funnelRes.data as Funnel) ?? null);
    setFunnelEvents((funnelEventsRes.data as FunnelEventRow[]) ?? []);
    setPortalUrl(cfgRes.data?.value ?? "");
    setLoadingData(false);
  };

  useEffect(() => {
    if (phase === "ok") loadData();
  }, [phase]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setLoginError("");

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      setLoginError("Acesso negado.");
      setSubmitting(false);
      return;
    }

    setPhase("verifying");
    const { data: isAdmin } = await (supabase.rpc as any)("is_platform_admin");
    if (isAdmin === true) {
      setPhase("ok");
    } else {
      await supabase.auth.signOut();
      setLoginError("Acesso negado.");
      setPhase("gate");
    }
    setSubmitting(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setEmail("");
    setPassword("");
    setPhase("gate");
  };

  if (phase === "checking") return null;
  if (phase === "denied") return <NotFound />;

  if (phase === "gate" || phase === "verifying") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0e1730] px-4">
        <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-2xl">
          <div className="h-12 w-12 rounded-2xl bg-[#0e1730] text-white flex items-center justify-center mx-auto mb-4">
            <Shield className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-bold text-center text-foreground mb-1">Área restrita</h1>
          <p className="text-xs text-muted-foreground text-center mb-6">Identifique-se para continuar.</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="adm-email" className="text-xs font-semibold">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="adm-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 h-11 rounded-xl"
                  autoFocus
                  required
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="adm-pw" className="text-xs font-semibold">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="adm-pw"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 pr-10 h-11 rounded-xl"
                  required
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {loginError && <p className="text-xs font-semibold text-destructive text-center">{loginError}</p>}

            <Button type="submit" className="w-full h-11 rounded-xl font-bold" disabled={submitting || phase === "verifying"}>
              {submitting || phase === "verifying" ? "Verificando..." : "Entrar"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  const statCards = stats
    ? [
        { key: "workspaces", label: "Workspaces", value: stats.workspaces, icon: Building2, color: "#00B4D8" },
        { key: "users", label: "Usuários", value: stats.usuarios, icon: Users, color: "#8B5CF6", dialog: "users" as DialogKey },
        { key: "members", label: "Membros ativos", value: stats.membros, icon: UserRound, color: "#0891B2" },
        { key: "people", label: "Pessoas cadastradas", value: stats.pessoas, icon: Users, color: "#DB2777" },
        { key: "demands", label: "Demandas", value: stats.demandas, icon: ListChecks, color: "#F97316", dialog: "demands" as DialogKey },
        { key: "done", label: "Demandas concluídas", value: stats.demandas_concluidas, icon: CheckCircle2, color: "#10B981" },
        { key: "forms", label: "Formulários", value: stats.formularios, icon: FileText, color: "#6D28D9" },
        { key: "logins", label: "Entradas registradas", value: stats.entradas_registradas, icon: MousePointerClick, color: "#CA8A04", dialog: "logins" as DialogKey },
      ]
    : [];

  const funnelStageBase = [
    {
      key: "landing_view",
      label: "Abriu o link",
      helper: "Chegou na home",
      total: funnel?.landing_views_total ?? 0,
      unique: funnel?.landing_views_unique_sessions ?? 0,
      uniqueLabel: "sessões únicas",
      accent: "#00B4D8",
    },
    {
      key: "signup_cta_click",
      label: "Clicou em criar conta",
      helper: "Apertou o CTA",
      total: funnel?.signup_clicks_total ?? 0,
      unique: funnel?.signup_clicks_unique_sessions ?? 0,
      uniqueLabel: "sessões únicas",
      accent: "#2DE2B8",
    },
    {
      key: "signup_success",
      label: "Criou conta",
      helper: "Finalizou cadastro",
      total: funnel?.signup_success_total ?? 0,
      unique: funnel?.signup_success_unique_users ?? 0,
      uniqueLabel: "usuários únicos",
      accent: "#8B5CF6",
    },
    {
      key: "workspace_entered",
      label: "Entrou em workspace",
      helper: "Acessou o app",
      total: funnel?.workspace_entries_total ?? 0,
      unique: funnel?.workspace_entries_unique_users ?? 0,
      uniqueLabel: "usuários únicos",
      accent: "#10B981",
    },
    {
      key: "workspace_created",
      label: "Criou workspace",
      helper: "Virou workspace",
      total: funnel?.workspace_creations_total ?? 0,
      accent: "#F97316",
    },
    {
      key: "workspace_join_requested",
      label: "Pediu entrada",
      helper: "Solicitou acesso",
      total: funnel?.workspace_join_requests_total ?? 0,
      accent: "#DB2777",
    },
  ];

  const maxFunnelTotal = Math.max(1, ...funnelStageBase.map((stage) => stage.total));
  const funnelStages = funnelStageBase.map((stage, index) => {
    const previousTotal = index > 0 ? funnelStageBase[index - 1].total : null;
    const conversion = previousTotal && previousTotal > 0 ? Math.round((stage.total / previousTotal) * 100) : null;
    return {
      ...stage,
      events: funnelEvents.filter((event) => event.event_key === stage.key),
      width: Math.max(42, Math.round((stage.total / maxFunnelTotal) * 100)),
      conversion,
    };
  });
  const stageByKey = new Map(funnelStages.map((stage) => [stage.key, stage]));

  return (
    <div className="min-h-screen bg-[#f5f8ff]">
      <header className="bg-[#0e1730] text-white">
        <div className="max-w-7xl mx-auto px-5 py-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <Shield className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold leading-tight">Painel do Moderador</h1>
            <p className="text-[11px] text-white/50">Visão global da plataforma BuzzUp</p>
          </div>
          <button onClick={loadData} title="Atualizar dados" className="p-2 rounded-lg hover:bg-white/10 text-white/70 transition-colors">
            <RefreshCw className={`h-4 w-4 ${loadingData ? "animate-spin" : ""}`} />
          </button>
          <button onClick={handleSignOut} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
            <LogOut className="h-3.5 w-3.5" /> Sair
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 py-6 space-y-6">
        {portalUrl && (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-white border border-border rounded-xl px-4 py-2.5">
            <Link2 className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="font-semibold shrink-0">Seu link secreto:</span>
            <code className="truncate">{portalUrl}</code>
          </div>
        )}

        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-bold text-foreground">Números da plataforma</h2>
            <span className="text-[11px] text-muted-foreground">Clique em Usuários, Demandas ou Entradas para abrir a lista detalhada.</span>
          </div>

          {!stats && loadingData ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {statCards.map((c) => {
                const interactive = !!c.dialog;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => c.dialog && setOpenDialog(c.dialog)}
                    className={`bg-white border border-border rounded-2xl p-4 text-left ${interactive ? "hover:border-primary/35 hover:shadow-sm transition-all cursor-pointer" : "cursor-default"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center mb-2" style={{ backgroundColor: `${c.color}1A`, color: c.color }}>
                        <c.icon className="h-4 w-4" />
                      </div>
                      {interactive && <span className="text-[10px] font-semibold text-primary">abrir</span>}
                    </div>
                    <p className="text-2xl font-extrabold text-foreground leading-none">{c.value}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{c.label}</p>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="grid lg:grid-cols-3 gap-4">
          {metricExplanations.map((item) => (
            <div key={item.title} className="bg-white border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Info className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">{item.text}</p>
            </div>
          ))}
        </section>

        <section className="grid xl:grid-cols-[1.25fr_0.75fr] gap-6">
          <div className="bg-white border border-border rounded-2xl p-5 overflow-hidden">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <MousePointerClick className="h-4 w-4 text-primary" />
                  Clique por clique em funil
                </h2>
                <p className="text-xs text-muted-foreground">Veja cada etapa, quantas pessoas chegaram nela e quem clicou por último.</p>
              </div>
            </div>

            <div className="space-y-4">
              {funnelStages.map((stage, index) => (
                <div key={stage.key} className="relative rounded-2xl border border-border/70 bg-gradient-to-br from-white to-muted/20 p-3.5">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-7 w-7 rounded-full text-white text-xs font-extrabold flex items-center justify-center shrink-0"
                            style={{ backgroundColor: stage.accent }}
                          >
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-foreground truncate">{stage.label}</p>
                            <p className="text-[11px] text-muted-foreground">{stage.helper}</p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xl font-extrabold text-foreground leading-none">{stage.total}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {"unique" in stage && stage.unique !== undefined ? `${stage.unique} ${stage.uniqueLabel}` : "total"}
                        </p>
                      </div>
                    </div>

                    <div className="px-1">
                      <div
                        className="mx-auto h-10 rounded-2xl shadow-sm flex items-center justify-center text-white text-xs font-extrabold transition-all"
                        style={{
                          width: `${stage.width}%`,
                          background: `linear-gradient(90deg, ${stage.accent}B3, ${stage.accent})`,
                        }}
                      >
                        {stage.conversion === null ? "Topo do funil" : `${stage.conversion}% do passo anterior`}
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-2">
                      {stage.events.slice(0, 4).map((event, idx) => (
                        <div key={`${stage.key}-${event.created_at}-${idx}`} className="rounded-xl bg-white border border-border/70 px-3 py-2 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: stage.accent }} />
                            <p className="text-xs font-semibold text-foreground truncate">{eventPersonLabel(event)}</p>
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                            {cleanEventText(event.user_email, "Sem e-mail")}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">{formatDateTime(event.created_at)}</p>
                        </div>
                      ))}
                      {stage.events.length === 0 && (
                        <div className="sm:col-span-2 xl:col-span-4 rounded-xl border border-dashed border-border px-3 py-2 text-[11px] text-muted-foreground">
                          Sem eventos individuais registrados nessa etapa.
                        </div>
                      )}
                    </div>

                    {stage.events.length > 4 && (
                      <p className="text-[10px] font-semibold text-primary pl-1">
                        +{stage.events.length - 4} cliques dessa etapa na linha do tempo ao lado
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden">
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Abriu o link</p>
                <p className="text-2xl font-extrabold text-foreground mt-1">{funnel?.landing_views_total ?? 0}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{funnel?.landing_views_unique_sessions ?? 0} sessões únicas</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Criar conta</p>
                <p className="text-2xl font-extrabold text-foreground mt-1">{funnel?.signup_clicks_total ?? 0}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{funnel?.signup_clicks_unique_sessions ?? 0} sessões únicas</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Contas criadas</p>
                <p className="text-2xl font-extrabold text-foreground mt-1">{funnel?.signup_success_total ?? 0}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{funnel?.signup_success_unique_users ?? 0} usuários únicos</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Entradas em workspace</p>
                <p className="text-2xl font-extrabold text-foreground mt-1">{funnel?.workspace_entries_total ?? 0}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{funnel?.workspace_entries_unique_users ?? 0} usuários únicos</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Workspaces criados</p>
                <p className="text-2xl font-extrabold text-foreground mt-1">{funnel?.workspace_creations_total ?? 0}</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Pedidos de entrada</p>
                <p className="text-2xl font-extrabold text-foreground mt-1">{funnel?.workspace_join_requests_total ?? 0}</p>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground mt-4">
              Observação: o histórico de "abriu o link" e "clicou em criar conta" começa a contar depois que o SQL novo for ativado no banco.
            </p>
          </div>

          <div className="bg-white border border-border rounded-2xl p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-bold text-foreground">Linha do tempo</h2>
                <p className="text-xs text-muted-foreground">Ordem real dos cliques mais recentes.</p>
              </div>
            </div>
            <div className="space-y-2 max-h-[650px] overflow-y-auto pr-1">
              {funnelEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum evento de funil registrado ainda.</p>
              ) : (
                funnelEvents.map((event, idx) => {
                  const stage = stageByKey.get(event.event_key);
                  return (
                    <div key={`${event.event_key}-${event.created_at}-${idx}`} className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: stage?.accent ?? "#00B4D8" }} />
                          <p className="text-xs font-semibold text-foreground truncate">{eventLabel[event.event_key] || event.event_key}</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">{formatDateTime(event.created_at)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {eventPersonLabel(event)}{event.user_email ? ` • ${cleanEventText(event.user_email)}` : ""}
                      </p>
                      {(event.workspace_name || event.source) && (
                        <p className="text-[11px] text-muted-foreground mt-1 truncate">
                          {event.workspace_name ? `Workspace: ${cleanEventText(event.workspace_name)}` : ""}
                          {event.workspace_name && event.source ? " • " : ""}
                          {event.source ? `Origem: ${cleanEventText(event.source)}` : ""}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <div className="hidden">
              {funnelEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum evento de funil registrado ainda.</p>
              ) : (
                funnelEvents.map((event, idx) => (
                  <div key={`${event.event_key}-${event.created_at}-${idx}`} className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold text-foreground">{eventLabel[event.event_key] || event.event_key}</p>
                      <span className="text-[10px] text-muted-foreground">{formatDateTime(event.created_at)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {event.user_name || "Visitante"}{event.user_email ? ` • ${event.user_email}` : ""}
                    </p>
                    {(event.workspace_name || event.source) && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {event.workspace_name ? `Workspace: ${event.workspace_name}` : ""}
                        {event.workspace_name && event.source ? " • " : ""}
                        {event.source ? `Origem: ${event.source}` : ""}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-bold text-foreground mb-3">Todos os workspaces ({workspaces.length})</h2>
          <div className="bg-white border border-border rounded-2xl overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Nome</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Código</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Owner</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground text-right">Membros</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground text-right">Demandas</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {workspaces.map((w) => (
                  <tr key={w.id} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-semibold text-foreground">{w.name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{w.code}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{w.owner_email || "—"}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{w.membros}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{w.demandas}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatDateTime(w.created_at)}</td>
                  </tr>
                ))}
                {workspaces.length === 0 && !loadingData && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-foreground">Nenhum workspace.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <Dialog open={openDialog === "users"} onOpenChange={(open) => !open && setOpenDialog(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Usuários cadastrados</DialogTitle>
            <DialogDescription>Nome e e-mail de todas as contas registradas na plataforma.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-auto border border-border rounded-xl">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Nome</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">E-mail</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground text-right">Workspaces</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground text-right">Pessoas</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {users.map((row) => (
                  <tr key={row.user_id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-foreground">{row.display_name || "Sem nome"}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{row.email || "Sem e-mail"}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{row.workspaces}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{row.pessoas}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatDateTime(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openDialog === "demands"} onOpenChange={(open) => !open && setOpenDialog(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Demandas da plataforma</DialogTitle>
            <DialogDescription>Workspace, responsável e nome de cada demanda registrada no site.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-auto border border-border rounded-xl">
            <table className="w-full text-sm min-w-[980px]">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Workspace</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Área</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Responsável</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">E-mail</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Demanda</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Status</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Data</th>
                </tr>
              </thead>
              <tbody>
                {demands.map((row) => (
                  <tr key={row.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-foreground">{row.workspace_name}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{row.area || "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-foreground">{row.responsible_name || "Sem responsável"}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{row.responsible_email || "—"}</td>
                    <td className="px-4 py-2.5 font-medium text-foreground">{row.title}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{statusLabel(row.status)}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{row.completed_at ? formatDateTime(row.completed_at) : (row.due_date || "—")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openDialog === "logins"} onOpenChange={(open) => !open && setOpenDialog(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Entradas no aplicativo</DialogTitle>
            <DialogDescription>Horário de entrada de todas as pessoas, somando todos os workspaces.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-auto border border-border rounded-xl">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Pessoa</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">E-mail</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Workspace</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Entrou em</th>
                </tr>
              </thead>
              <tbody>
                {globalLogins.map((row, idx) => (
                  <tr key={`${row.user_email}-${row.created_at}-${idx}`} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-foreground">{row.user_name}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{row.user_email}</td>
                    <td className="px-4 py-2.5 text-xs text-foreground">{row.workspace_name}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatDateTime(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
