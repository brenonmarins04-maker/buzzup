import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, LogOut, Lock, Mail, Eye, EyeOff, Building2, Users, ListChecks, CheckCircle2, FileText, MousePointerClick, Link2, RefreshCw } from "lucide-react";
import NotFound from "./NotFound";

// Apenas o HASH SHA-256 do código secreto vive no bundle — é matematicamente
// irreversível, então ler o código-fonte do site não revela o link.
const GATE_HASH = "f87a1893847e119387bc0cf1c5d78cd69b142048b304e9723d2471df2d133ad5";

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

type Stats = {
  workspaces: number; usuarios: number; membros: number; pessoas: number;
  demandas: number; demandas_concluidas: number; formularios: number; entradas_registradas: number;
};
type WsRow = {
  id: string; name: string; code: string; created_at: string;
  owner_email: string | null; membros: number; demandas: number;
};

type Phase = "checking" | "denied" | "gate" | "verifying" | "ok";

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
  const [portalUrl, setPortalUrl] = useState<string>("");
  const [loadingData, setLoadingData] = useState(false);

  // Nunca deixar mecanismos de busca indexarem esta rota
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);

  // Camada 1: o código na URL precisa bater com o hash
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!k) { setPhase("denied"); return; }
      try {
        const hex = await sha256Hex(k);
        if (cancelled) return;
        if (hex !== GATE_HASH) { setPhase("denied"); return; }
        // Camada 2: se já existe sessão, verifica no SERVIDOR se é o moderador
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;
        if (session) {
          const { data: isAdmin } = await (supabase.rpc as any)("is_platform_admin");
          if (cancelled) return;
          if (isAdmin === true) { setPhase("ok"); return; }
        }
        setPhase("gate");
      } catch {
        if (!cancelled) setPhase("denied");
      }
    })();
    return () => { cancelled = true; };
  }, [k]);

  const loadData = async () => {
    setLoadingData(true);
    const [statsRes, wsRes, cfgRes] = await Promise.all([
      (supabase.rpc as any)("admin_platform_stats"),
      (supabase.rpc as any)("admin_list_workspaces"),
      (supabase.from("platform_admin_config") as any).select("value").eq("key", "admin_portal_url").maybeSingle(),
    ]);
    setStats((statsRes.data as Stats) ?? null);
    setWorkspaces(((wsRes.data as WsRow[]) ?? []));
    setPortalUrl(cfgRes.data?.value ?? "");
    setLoadingData(false);
  };

  useEffect(() => { if (phase === "ok") loadData(); }, [phase]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setLoginError("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) {
      // Mensagem genérica de propósito — não revela se o e-mail existe
      setLoginError("Acesso negado.");
      setSubmitting(false);
      return;
    }
    setPhase("verifying");
    // Camada 3: o banco decide se esta conta é o moderador
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
    setEmail(""); setPassword("");
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
                <Input id="adm-email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="pl-9 h-11 rounded-xl" autoFocus required autoComplete="off" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adm-pw" className="text-xs font-semibold">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="adm-pw" type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} className="pl-9 pr-10 h-11 rounded-xl" required autoComplete="off" />
                <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" tabIndex={-1}>
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {loginError && <p className="text-xs font-semibold text-destructive text-center">{loginError}</p>}
            <Button type="submit" className="w-full h-11 rounded-xl font-bold" disabled={submitting || phase === "verifying"}>
              {submitting || phase === "verifying" ? "Verificando…" : "Entrar"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // phase === "ok" — painel do moderador
  const statCards = stats ? [
    { label: "Workspaces", value: stats.workspaces, icon: Building2, color: "#2563EB" },
    { label: "Usuários", value: stats.usuarios, icon: Users, color: "#8B5CF6" },
    { label: "Membros ativos", value: stats.membros, icon: Users, color: "#0891B2" },
    { label: "Pessoas cadastradas", value: stats.pessoas, icon: Users, color: "#DB2777" },
    { label: "Demandas", value: stats.demandas, icon: ListChecks, color: "#F97316" },
    { label: "Demandas concluídas", value: stats.demandas_concluidas, icon: CheckCircle2, color: "#10B981" },
    { label: "Formulários", value: stats.formularios, icon: FileText, color: "#6D28D9" },
    { label: "Entradas registradas", value: stats.entradas_registradas, icon: MousePointerClick, color: "#CA8A04" },
  ] : [];

  return (
    <div className="min-h-screen bg-[#f5f8ff]">
      <header className="bg-[#0e1730] text-white">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center gap-3">
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

      <main className="max-w-6xl mx-auto px-5 py-6 space-y-6">
        {portalUrl && (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-white border border-border rounded-xl px-4 py-2.5">
            <Link2 className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="font-semibold shrink-0">Seu link secreto (guardado na nuvem):</span>
            <code className="truncate">{portalUrl}</code>
          </div>
        )}

        <section>
          <h2 className="text-sm font-bold text-foreground mb-3">Números da plataforma</h2>
          {!stats && loadingData ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {statCards.map(c => (
                <div key={c.label} className="bg-white border border-border rounded-2xl p-4">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center mb-2" style={{ backgroundColor: `${c.color}1A`, color: c.color }}>
                    <c.icon className="h-4 w-4" />
                  </div>
                  <p className="text-2xl font-extrabold text-foreground leading-none">{c.value}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{c.label}</p>
                </div>
              ))}
            </div>
          )}
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
                {workspaces.map(w => (
                  <tr key={w.id} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-semibold text-foreground">{w.name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{w.code}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{w.owner_email || "—"}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{w.membros}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{w.demandas}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{new Date(w.created_at).toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
                {workspaces.length === 0 && !loadingData && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-foreground">Nenhum workspace.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
