import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  CalendarDays, Megaphone,
  FolderKanban, Bell, Search, ChevronLeft, Plus, Users, LogOut, Eye, Shield, Briefcase, Crown, Sparkles, Home, Building2,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AREAS } from "@/lib/areas";
import { toast } from "sonner";
import QuickCreateMenu from "@/components/modals/QuickCreateMenu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import TaskModal from "@/components/modals/TaskModal";
import PostModal from "@/components/modals/PostModal";
import EventModal from "@/components/modals/EventModal";
import NotificationPanel from "@/components/NotificationPanel";
import BroadcastBar from "@/components/BroadcastBar";
import BroadcastModal from "@/components/modals/BroadcastModal";

const areaColor = (path: string) => AREAS.find(a => a.path === path)?.color;

const navItems = [
  { to: "/",            icon: Home,         label: "Início" },
  { to: "/calendar",    icon: CalendarDays, label: "Calendário" },
  { to: "/people",      icon: Users,        label: "Pessoas" },
  { to: "/projetos",    icon: FolderKanban, label: "Projetos",    color: areaColor("/projetos") },
  { to: "/mercado",     icon: Briefcase,    label: "Mercado",     color: areaColor("/mercado") },
  { to: "/gg",          icon: Sparkles,     label: "GG",          color: areaColor("/gg") },
  { to: "/presidencia", icon: Crown,        label: "Presidência", color: areaColor("/presidencia") },
  { to: "/members",     icon: Shield,       label: "Acessos" },
];

const areaItems = [
  { to: "/projetos",    icon: FolderKanban, label: "Projetos",    color: areaColor("/projetos") },
  { to: "/mercado",     icon: Briefcase,    label: "Mercado",     color: areaColor("/mercado") },
  { to: "/gg",          icon: Sparkles,     label: "GG",          color: areaColor("/gg") },
  { to: "/presidencia", icon: Crown,        label: "Presidência", color: areaColor("/presidencia") },
];

const mobileNavItems = [
  { to: "/people",   icon: Users,        label: "Pessoas" },
  { to: "/calendar", icon: CalendarDays, label: "Calendário" },
  { to: "/",         icon: Home,         label: "Início" },
  { to: "areas",     icon: FolderKanban, label: "Áreas" },
  { to: "/members",  icon: Shield,       label: "Acessos" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const isMobile = useIsMobile();
  const { notifications } = useData();
  const { displayName, signOut, isAdmin, isOwner, role, user, myWorkspaces } = useAuth();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;
  const [pendingJoinCount, setPendingJoinCount] = useState(0);

  const ownedWorkspaceIds = myWorkspaces.filter(w => w.role === "owner").map(w => w.workspace_id);

  useEffect(() => {
    if (!user || ownedWorkspaceIds.length === 0) { setPendingJoinCount(0); return; }
    let cancelled = false;
    const load = async () => {
      const { count } = await supabase
        .from("workspace_join_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .in("workspace_id", ownedWorkspaceIds)
        .neq("user_id", user.id);
      if (!cancelled) setPendingJoinCount(count || 0);
    };
    load();
    const ch = supabase
      .channel(`pending-joins-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "workspace_join_requests" }, () => load())
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [user?.id, ownedWorkspaceIds.join(",")]);

  const [taskModal, setTaskModal] = useState(false);
  const [postModal, setPostModal] = useState(false);
  const [eventModal, setEventModal] = useState(false);
  const [broadcastModal, setBroadcastModal] = useState(false);

  const initials = displayName
    ? displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  const roleLabel = role === "owner" ? "Owner" : role === "admin" ? "Admin" : role === "member" ? "Member" : "—";
  const RoleBadge = () => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${isAdmin ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
      {isAdmin ? <Shield className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      {roleLabel}
    </span>
  );

  if (isMobile) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <header className="h-12 px-4 flex items-center justify-between border-b border-border bg-card shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold text-foreground tracking-tight text-base shrink-0">BuzzUp</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <RoleBadge />
            <button onClick={() => navigate("/welcome")} title="Trocar workspace" className="p-2 rounded-md hover:bg-accent text-muted-foreground">
              <Building2 className="h-4 w-4" />
            </button>
            <button onClick={() => setShowNotifications(!showNotifications)} className="relative p-2 rounded-md hover:bg-accent text-muted-foreground">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && <span className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">{unreadCount > 9 ? "9+" : unreadCount}</span>}
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
        <nav className="fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border flex items-center justify-around h-16 px-1">
          {mobileNavItems.map((item) => {
            if (item.to === "areas") {
              return (
                <Popover key="areas">
                  <PopoverTrigger asChild>
                    <button className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md text-[10px] font-medium transition-colors min-w-0 text-muted-foreground">
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="center" className="w-48 p-1">
                    {areaItems.map((a) => (
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
                  {item.to === "/members" && pendingJoinCount > 0 && (
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
        <TaskModal open={taskModal} onOpenChange={setTaskModal} />
        <PostModal open={postModal} onOpenChange={setPostModal} />
        <EventModal open={eventModal} onOpenChange={setEventModal} />
        <BroadcastModal open={broadcastModal} onOpenChange={setBroadcastModal} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className={`${collapsed ? "w-16" : "w-60"} shrink-0 border-r border-border bg-card flex flex-col transition-all duration-200`}>
        <div className="h-14 px-4 flex items-center justify-between border-b border-border">
          {!collapsed && <span className="font-bold text-foreground tracking-tight text-lg">BuzzUp</span>}
          <button onClick={() => setCollapsed(!collapsed)} className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground">
            <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
          </button>
        </div>
        <nav className="flex-1 py-4 px-2 flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to}
              style={({ isActive }) => (isActive && (item as any).color
                ? { backgroundColor: `${(item as any).color}1F`, color: (item as any).color, boxShadow: `inset 3px 0 0 ${(item as any).color}` }
                : (item as any).color
                  ? { color: (item as any).color }
                  : undefined)}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-semibold transition-colors ${isActive && !(item as any).color ? "bg-accent text-foreground shadow-sm" : !isActive ? "text-muted-foreground hover:text-foreground hover:bg-accent/50" : ""} ${collapsed ? "justify-center" : ""}`}>
              <div className="relative">
                <item.icon className="h-4 w-4 shrink-0" />
                {item.to === "/members" && pendingJoinCount > 0 && collapsed && (
                  <span className="absolute -top-1.5 -right-1.5 h-3.5 min-w-3.5 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                    {pendingJoinCount > 9 ? "9+" : pendingJoinCount}
                  </span>
                )}
              </div>
              {!collapsed && (
                <span className="flex-1 flex items-center justify-between">
                  <span>{item.label}</span>
                  {item.to === "/members" && pendingJoinCount > 0 && (
                    <span className="h-5 min-w-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                      {pendingJoinCount > 9 ? "9+" : pendingJoinCount}
                    </span>
                  )}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-border">
          {isOwner && (
            <button
              onClick={() => setBroadcastModal(true)}
              title="Nova mensagem geral"
              className={`w-full mb-2 flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border-2 border-red-500 bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors ${collapsed ? "justify-center" : ""}`}
            >
              <Plus className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Mensagem geral</span>}
            </button>
          )}
          <div className={`flex items-center gap-3 px-2 py-1.5 ${collapsed ? "justify-center" : ""}`}>
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold shrink-0">{initials}</div>
            {!collapsed && (
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-medium text-foreground truncate">{displayName || "Usuário"}</span>
              </div>
            )}
            {!collapsed && (
              <>
                <button onClick={() => navigate("/welcome")} className="p-1 rounded hover:bg-accent text-muted-foreground" title="Trocar workspace">
                  <Building2 className="h-4 w-4" />
                </button>
                <button onClick={() => signOut()} className="p-1 rounded hover:bg-accent text-muted-foreground" title="Sair">
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 px-6 flex items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="text" placeholder="Buscar tarefas, posts, projetos..." className="h-9 w-72 rounded-md border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <RoleBadge />
            <span className="text-sm font-medium text-muted-foreground">{displayName || "Workspace"}</span>
            <button onClick={() => setShowNotifications(!showNotifications)} className="relative p-2 rounded-md hover:bg-accent transition-colors text-muted-foreground">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && <span className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">{unreadCount > 9 ? "9+" : unreadCount}</span>}
            </button>
          </div>
        </header>
        {showNotifications && <NotificationPanel onClose={() => setShowNotifications(false)} />}
        <div className="flex-1 overflow-auto scrollbar-thin">
          <BroadcastBar />
          <div className="p-6">{children}</div>
        </div>
      </main>
      <BroadcastModal open={broadcastModal} onOpenChange={setBroadcastModal} />
    </div>
  );
}
