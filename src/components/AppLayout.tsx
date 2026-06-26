import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { NavLink, useNavigate } from "react-router-dom";
import {
  CalendarDays, Megaphone,
  FolderKanban, Bell, Search, ChevronLeft, Plus, Users, LogOut, Eye, Shield, Briefcase, Crown, Sparkles, Home, UsersRound, Pencil, Settings, BarChart2,
} from "lucide-react";
import { useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AREAS, getAreaLabel, getTeamColor } from "@/lib/areas";
import { getLeaderKeys } from "@/lib/leadership";
import { toast } from "sonner";
import QuickCreateMenu from "@/components/modals/QuickCreateMenu";
import EditAreaNamesModal from "@/components/modals/EditAreaNamesModal";
import { useAreaNames } from "@/hooks/useAreaNames";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import EventModal from "@/components/modals/EventModal";
import NotificationPanel from "@/components/NotificationPanel";
import BroadcastBar from "@/components/BroadcastBar";
import BroadcastModal from "@/components/modals/BroadcastModal";
import CreateTeamModal from "@/components/modals/CreateTeamModal";

const areaColor = (path: string) => AREAS.find(a => a.path === path)?.color;

const areaIcons: Record<string, any> = {
  projetos: FolderKanban,
  mercado: Briefcase,
  gg: Sparkles,
  presidencia: Crown,
};

function getNavItems() {
  return [
    { to: "/",         icon: Home,         label: "Início" },
    { to: "/calendar", icon: CalendarDays, label: "Calendário" },
    { to: "/people",   icon: Users,        label: "Pessoas" },
    ...AREAS.map(a => ({ to: a.path, icon: areaIcons[a.key] || FolderKanban, label: getAreaLabel(a.key), color: a.color })),
  ];
}

function getAccessItem() {
  return { to: "/members", icon: Shield, label: "Acessos" };
}

function getAreaItems() {
  return AREAS.map(a => ({ to: a.path, icon: areaIcons[a.key] || FolderKanban, label: getAreaLabel(a.key), color: a.color }));
}

const mobileNavItems = [
  { to: "/calendar", icon: CalendarDays, label: "Calendário" },
  { to: "/",         icon: Home,         label: "Início" },
  { to: "areas",     icon: FolderKanban, label: "Áreas" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const isMobile = useIsMobile();
  const { notifications, teams, people } = useData();
  // `teams` = todos os times do workspace (para detectar workspace sem times)
  const { displayName, signOut, isAdmin, isOwner, role, user, myWorkspaces, activeWorkspaceId } = useAuth();

  // Find teams the current user belongs to
  // Uses ALL person records linked to this user (guards against duplicate person rows)
  const myTeams = useMemo(() => {
    if (!user) return [];
    const myPersonIds = new Set(
      people.filter(p => p.userId === user.id).map(p => p.id)
    );
    // Times onde sou membro OU que eu lidero (líder pode não estar na lista de membros)
    const leaderKeys = getLeaderKeys(people, user.id);
    return teams.filter(t =>
      t.memberIds.some(id => myPersonIds.has(id)) || leaderKeys.has(`team_${t.id}`)
    );
  }, [user, people, teams]);
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;
  const [pendingJoinCount, setPendingJoinCount] = useState(0);

  const ownedWorkspaceIds = myWorkspaces.filter(w => w.role === "owner").map(w => w.workspace_id);
  const activeWorkspaceName = myWorkspaces.find(w => w.workspace_id === activeWorkspaceId)?.name || "Workspace";

  useEffect(() => {
    if (!user || ownedWorkspaceIds.length === 0) { setPendingJoinCount(0); return; }
    let cancelled = false;
    let initialLoadDone = false;

    const load = async () => {
      const { count } = await supabase
        .from("workspace_join_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .in("workspace_id", ownedWorkspaceIds)
        .neq("user_id", user.id);
      if (!cancelled) setPendingJoinCount(count || 0);
    };
    load().then(() => { initialLoadDone = true; });

    let ch: ReturnType<typeof supabase.channel> | null = null;
    try {
      ch = supabase
        .channel(`pending-joins-${user.id}-${Math.random().toString(36).slice(2)}`)
        // New join request arrived → toast the owner
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "workspace_join_requests" }, (payload) => {
          const wsId = (payload.new as any)?.workspace_id;
          if (initialLoadDone && ownedWorkspaceIds.includes(wsId)) {
            toast.info("Novo pedido de entrada!", {
              description: "Alguém quer entrar no workspace. Veja em Acessos → Pedidos.",
              duration: 8000,
            });
          }
          load();
        })
        // Request cancelled/rejected/approved → just refresh count
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "workspace_join_requests" }, () => load())
        .on("postgres_changes", { event: "DELETE", schema: "public", table: "workspace_join_requests" }, () => load())
        .subscribe();
    } catch { ch = null; }
    return () => { cancelled = true; if (ch) supabase.removeChannel(ch); };
  }, [user?.id, ownedWorkspaceIds.join(",")]);

  // Areas the current user belongs to (for mobile "Minha Área" shortcut)
  const myAreas = useMemo(() => {
    if (!user) return [];
    const myPerson = people.find(p => p.userId === user.id);
    if (!myPerson) return [];
    const areaKeys = myPerson.areas && myPerson.areas.length > 0
      ? myPerson.areas
      : (myPerson.area ? [myPerson.area] : []);
    return areaKeys.map(key => AREAS.find(a => a.key === key)).filter(Boolean) as typeof AREAS;
  }, [user, people]);

  const [eventModal, setEventModal] = useState(false);
  const [broadcastModal, setBroadcastModal] = useState(false);
  const [editAreasModal, setEditAreasModal] = useState(false);
  const [createTeamModal, setCreateTeamModal] = useState(false);

  // Nav items stagger: triggers after sidebar entrance animation is mostly done
  const [navIn, setNavIn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setNavIn(true), 200);
    return () => clearTimeout(t);
  }, []);

  // Load custom area names per workspace — version triggers re-render of nav items
  const { version: areaNamesVersion } = useAreaNames();

  // Must be called unconditionally (before any early return) to satisfy Rules of Hooks.
  // areaNamesVersion dependency forces recompute when custom area names are saved.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const navItems = useMemo(() => getNavItems(), [areaNamesVersion]);

  const fullName =
    (displayName && displayName.trim()) ||
    (user?.email ? user.email.split("@")[0] : "") ||
    "Usuário";
  const initials = fullName
    ? fullName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  const roleLabel = role === "owner" ? "Owner" : role === "admin" ? "Diretor" : role === "member" ? "Assessor" : role === "leader" ? "Líder" : "—";
  const RoleBadge = () => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${isAdmin ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
      {isAdmin ? <Shield className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      {roleLabel}
    </span>
  );

  if (isMobile) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <header className="h-12 px-4 flex items-center justify-between border-b border-border glass-header shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold text-foreground tracking-tight text-base shrink-0">BuzzUp</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <RoleBadge />
            <button onClick={() => navigate("/welcome")} title="Trocar workspace" className="p-2 rounded-md hover:bg-accent text-muted-foreground">
              <Home className="h-4 w-4" />
            </button>
            <button onClick={() => navigate("/settings")} title="Menu" className="relative p-2 rounded-md hover:bg-accent text-muted-foreground">
              <Settings className="h-4 w-4" />
              {pendingJoinCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                  {pendingJoinCount > 9 ? "9+" : pendingJoinCount}
                </span>
              )}
            </button>
            <button onClick={() => signOut()} className="p-2 rounded-md hover:bg-accent text-muted-foreground">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>
        {showNotifications && <NotificationPanel onClose={() => setShowNotifications(false)} />}
        <main className="flex-1 overflow-auto pb-24 scrollbar-thin">
          <BroadcastBar />
          <div className="p-4">{children}</div>
        </main>
        {isOwner && (
          <button
            onClick={() => setBroadcastModal(true)}
            title="Nova mensagem geral"
            className="fixed bottom-24 left-4 z-40 h-11 w-11 rounded-full bg-red-500 text-white shadow-lg flex items-center justify-center hover:bg-red-600 active:scale-95 transition-all"
          >
            <Megaphone className="h-5 w-5" />
          </button>
        )}
        <nav className="fixed bottom-0 left-0 right-0 z-30 glass-header border-t border-border flex items-center justify-around h-16 px-1">
          {mobileNavItems.map((item) => {
            if (item.to === "myarea") {
              // Shortcut to the user's own area(s)
              if (myAreas.length === 0) {
                // No area assigned — show a disabled placeholder
                return (
                  <button key="myarea" disabled className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md text-[10px] font-medium text-muted-foreground/40 min-w-0">
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              }
              if (myAreas.length === 1) {
                const area = myAreas[0];
                const AreaIcon = areaIcons[area.key] || FolderKanban;
                return (
                  <NavLink key="myarea" to={area.path}
                    style={({ isActive }) => isActive
                      ? { color: area.color }
                      : { color: area.color }}
                    className={({ isActive }) => `flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md text-[10px] font-medium transition-colors min-w-0 ${isActive ? "opacity-100" : "opacity-60"}`}>
                    <AreaIcon className="h-5 w-5 shrink-0" />
                    <span className="truncate">{getAreaLabel(area.key)}</span>
                  </NavLink>
                );
              }
              // Multiple areas — popover
              return (
                <Popover key="myarea">
                  <PopoverTrigger asChild>
                    <button className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md text-[10px] font-medium transition-colors min-w-0 text-muted-foreground">
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="start" className="w-44 p-1">
                    {myAreas.map(area => {
                      const AreaIcon = areaIcons[area.key] || FolderKanban;
                      return (
                        <NavLink key={area.path} to={area.path}
                          style={({ isActive }) => isActive
                            ? { backgroundColor: `${area.color}1F`, color: area.color }
                            : { color: area.color }}
                          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold hover:bg-accent/50">
                          <AreaIcon className="h-4 w-4" />
                          <span>{getAreaLabel(area.key)}</span>
                        </NavLink>
                      );
                    })}
                  </PopoverContent>
                </Popover>
              );
            }
            if (item.to === "areas") {
              return (
                <Popover key="areas">
                  <PopoverTrigger asChild>
                    <button className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md text-[10px] font-medium transition-colors min-w-0 text-muted-foreground">
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="center" className="w-52 p-1 max-h-[60vh] overflow-y-auto">
                    {/* Times do usuário — aparecem em cima das áreas */}
                    {myTeams.length > 0 && (
                      <>
                        <div className="px-3 pt-1.5 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Times</div>
                        {myTeams.map(team => {
                          const tc = getTeamColor(team.id);
                          return (
                            <NavLink key={team.id} to={`/time/${team.id}`}
                              style={({ isActive }) => isActive
                                ? { backgroundColor: `${tc}1F`, color: tc }
                                : { color: tc }}
                              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold hover:bg-accent/50">
                              <UsersRound className="h-4 w-4 shrink-0" />
                              <span className="truncate">{team.name}</span>
                            </NavLink>
                          );
                        })}
                        <div className="border-t border-border my-1" />
                        <div className="px-3 pt-1 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Áreas</div>
                      </>
                    )}
                    {getAreaItems().map((a) => (
                      <NavLink key={a.to} to={a.to}
                        style={({ isActive }) => isActive
                          ? { backgroundColor: `${a.color}1F`, color: a.color }
                          : { color: a.color }}
                        className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold hover:bg-accent/50">
                        <a.icon className="h-4 w-4" />
                        <span>{a.label}</span>
                      </NavLink>
                    ))}
                  </PopoverContent>
                </Popover>
              );
            }
            return (
              <NavLink key={item.to} to={item.to}
                className={({ isActive }) => `flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md text-[10px] font-medium transition-colors min-w-0 ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                <div className="relative">
                  <item.icon className="h-5 w-5 shrink-0" />
                  {item.to === "/settings" && pendingJoinCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                      {pendingJoinCount > 9 ? "9+" : pendingJoinCount}
                    </span>
                  )}
                </div>
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <EventModal open={eventModal} onOpenChange={setEventModal} />
        <BroadcastModal open={broadcastModal} onOpenChange={setBroadcastModal} />
      </div>
    );
  }

  // Stagger helper for nav items
  const navStagger = (idx: number): React.CSSProperties => ({
    opacity: navIn ? 1 : 0,
    transform: navIn ? "none" : "translateX(-10px)",
    transition: `opacity 0.2s ease-out ${idx * 28}ms, transform 0.2s ease-out ${idx * 28}ms`,
  });

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <motion.aside
        className={`${collapsed ? "w-16" : "w-60"} login-blue-panel shrink-0 flex flex-col transition-[width] duration-200 overflow-hidden`}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="h-14 px-4 flex items-center justify-between border-b border-white/10 shrink-0">
          {!collapsed && <span className="font-bold text-white tracking-tight text-lg">BuzzUp</span>}
          <button onClick={() => setCollapsed(!collapsed)} className="p-1 rounded hover:bg-white/10 transition-colors text-white/60 hover:text-white">
            <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
          </button>
        </div>
        <nav className="flex-1 py-4 px-2 flex flex-col gap-1 overflow-y-auto scrollbar-thin">
          {/* Main nav items (sem Acessos) */}
          {navItems.map((item, idx) => (
            <div key={item.to} style={navStagger(idx)}>
              <NavLink to={item.to}
                style={({ isActive }) => (isActive && (item as any).color
                  ? { backgroundColor: `${(item as any).color}33`, color: (item as any).color, boxShadow: `inset 3px 0 0 ${(item as any).color}` }
                  : (item as any).color
                    ? { color: (item as any).color }
                    : undefined)}
                className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-semibold transition-colors ${isActive && !(item as any).color ? "bg-white/20 text-white" : !isActive ? "text-white/65 hover:text-white hover:bg-white/10" : ""} ${collapsed ? "justify-center" : ""}`}>
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            </div>
          ))}

          {/* ── Times (sempre visível para admin/owner; visível para members que têm time) ── */}
          {(isAdmin || myTeams.length > 0) && (
            <>
              {!collapsed && (
                <div className="px-3 pt-3 pb-1 flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Times</span>
                  {isAdmin && teams.length === 0 && (
                    <button
                      onClick={() => setCreateTeamModal(true)}
                      title="Criar time"
                      className="h-5 w-5 rounded flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
              {collapsed && <div className="border-t border-white/15 my-2" />}
              {myTeams.map(team => {
                const tc = getTeamColor(team.id);
                return (
                  <NavLink key={team.id} to={`/time/${team.id}`}
                    style={({ isActive }) => isActive
                      ? { backgroundColor: `${tc}33`, color: tc, boxShadow: `inset 3px 0 0 ${tc}` }
                      : { color: tc }}
                    className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-semibold transition-colors ${!isActive ? "hover:bg-white/10" : ""} ${collapsed ? "justify-center" : ""}`}>
                    <UsersRound className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">{team.name}</span>}
                  </NavLink>
                );
              })}
            </>
          )}

          {/* ── Acessos (sempre por último) ── */}
          {(() => {
            const item = getAccessItem();
            return (
              <NavLink to={item.to}
                className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-semibold transition-colors ${isActive ? "bg-white/20 text-white" : "text-white/65 hover:text-white hover:bg-white/10"} ${collapsed ? "justify-center" : ""}`}>
                <div className="relative">
                  <item.icon className="h-4 w-4 shrink-0" />
                  {pendingJoinCount > 0 && collapsed && (
                    <span className="absolute -top-1.5 -right-1.5 h-3.5 min-w-3.5 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                      {pendingJoinCount > 9 ? "9+" : pendingJoinCount}
                    </span>
                  )}
                </div>
                {!collapsed && (
                  <span className="flex-1 flex items-center justify-between">
                    <span>{item.label}</span>
                    {pendingJoinCount > 0 && (
                      <span className="h-5 min-w-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                        {pendingJoinCount > 9 ? "9+" : pendingJoinCount}
                      </span>
                    )}
                  </span>
                )}
              </NavLink>
            );
          })()}

          {/* ── Relatórios (apenas admins/owners, desktop only) ── */}
          {isAdmin && (
            <NavLink to="/reports"
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-semibold transition-colors ${isActive ? "bg-white/20 text-white" : "text-white/65 hover:text-white hover:bg-white/10"} ${collapsed ? "justify-center" : ""}`}>
              <BarChart2 className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Relatórios</span>}
            </NavLink>
          )}
        </nav>
        <div className="p-3 border-t border-white/10 shrink-0">
          {isAdmin && (
            <button
              onClick={() => setEditAreasModal(true)}
              title="Editar nomes das áreas"
              className={`w-full mb-2 flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors ${collapsed ? "justify-center" : ""}`}
            >
              <Pencil className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Editar áreas</span>}
            </button>
          )}
          {isOwner && (
            <button
              onClick={() => setBroadcastModal(true)}
              title="Nova mensagem geral"
              className={`w-full mb-2 flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border border-red-400/50 bg-red-500/20 text-red-200 hover:bg-red-500/30 transition-colors ${collapsed ? "justify-center" : ""}`}
            >
              <Plus className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Mensagem geral</span>}
            </button>
          )}
          <div className={`flex items-center gap-3 px-2 py-1.5 rounded-2xl bg-white/12 border border-white/10 ${collapsed ? "justify-center" : ""}`}>
            <div className="h-8 w-8 rounded-full bg-white/90 flex items-center justify-center text-primary text-xs font-bold shrink-0">{initials}</div>
            {!collapsed && (
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-medium text-white truncate">{fullName}</span>
              </div>
            )}
            {!collapsed && (
              <>
                <button onClick={() => navigate("/welcome")} className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors" title="Trocar workspace">
                  <Home className="h-4 w-4" />
                </button>
                <button onClick={() => signOut()} className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors" title="Sair">
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </motion.aside>
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 px-6 flex items-center justify-between border-b border-border glass-header shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="text" placeholder="Buscar demandas, posts, projetos..." className="h-10 w-80 rounded-2xl border border-input bg-white/78 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <RoleBadge />
            <span className="text-sm font-medium text-muted-foreground">{activeWorkspaceName}</span>
            <button onClick={() => setShowNotifications(!showNotifications)} className="relative p-2 rounded-md hover:bg-accent transition-colors text-muted-foreground">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && <span className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">{unreadCount > 9 ? "9+" : unreadCount}</span>}
            </button>
          </div>
        </header>
        {showNotifications && <NotificationPanel onClose={() => setShowNotifications(false)} />}
        <div className="flex-1 overflow-auto scrollbar-thin">
          <BroadcastBar />
          <div className="p-6 lg:p-7">{children}</div>
        </div>
      </main>
      <BroadcastModal open={broadcastModal} onOpenChange={setBroadcastModal} />
      <EditAreaNamesModal open={editAreasModal} onOpenChange={setEditAreasModal} />
      <CreateTeamModal open={createTeamModal} onOpenChange={setCreateTeamModal} />
    </div>
  );
}
