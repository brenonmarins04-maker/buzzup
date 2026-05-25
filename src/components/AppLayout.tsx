import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, CalendarDays, CheckSquare, Megaphone,
  FolderKanban, Bell, Search, ChevronLeft, Plus, Users, LogOut, UsersRound, Eye, Shield, KeyRound, Trophy,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import QuickCreateMenu from "@/components/modals/QuickCreateMenu";
import TaskModal from "@/components/modals/TaskModal";
import PostModal from "@/components/modals/PostModal";
import EventModal from "@/components/modals/EventModal";
import NotificationPanel from "@/components/NotificationPanel";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Início" },
  { to: "/calendar", icon: CalendarDays, label: "Calendário" },
  { to: "/tasks", icon: CheckSquare, label: "Tarefas" },
  { to: "/content", icon: Megaphone, label: "Conteúdo" },
  { to: "/projects", icon: FolderKanban, label: "Projetos" },
  { to: "/teams", icon: UsersRound, label: "Equipes" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const isMobile = useIsMobile();
  const { notifications } = useData();
  const { displayName, signOut, isAdmin, accessCode, redeemCode } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;
  const [codeInput, setCodeInput] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  const [taskModal, setTaskModal] = useState(false);
  const [postModal, setPostModal] = useState(false);
  const [eventModal, setEventModal] = useState(false);

  const initials = displayName
    ? displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  const handleRedeem = async () => {
    if (!codeInput.trim() || redeeming) return;
    setRedeeming(true);
    const { ok, error } = await redeemCode(codeInput);
    setRedeeming(false);
    if (ok) {
      toast.success("Acesso de admin liberado!");
      setCodeInput("");
      setTimeout(() => window.location.reload(), 600);
    } else {
      toast.error(error || "Código inválido");
    }
  };

  const RoleBadge = () => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${isAdmin ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
      {isAdmin ? <Shield className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      {isAdmin ? "Admin" : "Visualizador"}
    </span>
  );

  const CodeBox = () => {
    if (isAdmin) {
      return (
        <button
          onClick={() => { if (accessCode) { navigator.clipboard.writeText(accessCode); toast.success("Código copiado"); } }}
          title="Código do workspace (clique para copiar)"
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-border bg-background hover:bg-accent transition-colors text-xs font-mono tracking-wider text-foreground"
        >
          <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
          {accessCode || "------"}
        </button>
      );
    }
    return (
      <div className="inline-flex items-center gap-1 h-8 rounded-md border border-border bg-background overflow-hidden">
        <KeyRound className="h-3.5 w-3.5 text-muted-foreground ml-2" />
        <input
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value.toUpperCase().slice(0, 6))}
          onKeyDown={(e) => e.key === "Enter" && handleRedeem()}
          placeholder="CÓDIGO"
          maxLength={6}
          className="h-full w-24 bg-transparent px-1.5 text-xs font-mono tracking-wider focus:outline-none placeholder:text-muted-foreground/50"
        />
        <button
          onClick={handleRedeem}
          disabled={redeeming || codeInput.length < 6}
          className="h-full px-2 text-[10px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
        >
          OK
        </button>
      </div>
    );
  };

  if (isMobile) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <header className="h-12 px-4 flex items-center justify-between border-b border-border bg-card shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold text-foreground tracking-tight text-base shrink-0">BuzzUp</span>
            <CodeBox />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <RoleBadge />
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
        <main className="flex-1 overflow-auto p-4 pb-24 scrollbar-thin">{children}</main>
        {isAdmin && (
          <QuickCreateMenu onCreateTask={() => setTaskModal(true)} onCreatePost={() => setPostModal(true)} onCreateItem={() => setEventModal(true)}>
            <button className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all">
              <Plus className="h-6 w-6" />
            </button>
          </QuickCreateMenu>
        )}
        <nav className="fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border flex items-center justify-around h-16 px-1">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to}
              className={({ isActive }) => `flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md text-[10px] font-medium transition-colors min-w-0 ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
              <item.icon className="h-5 w-5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <TaskModal open={taskModal} onOpenChange={setTaskModal} />
        <PostModal open={postModal} onOpenChange={setPostModal} />
        <EventModal open={eventModal} onOpenChange={setEventModal} />
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
          {[
            ...navItems,
            { to: "/people", icon: Users, label: "Pessoas" },
            ...(isAdmin ? [{ to: "/gamification", icon: Trophy, label: "Gamificação" }] : []),
          ].map((item) => (
            <NavLink key={item.to} to={item.to}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? "bg-accent text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"} ${collapsed ? "justify-center" : ""}`}>
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-border">
          <div className={`flex items-center gap-3 px-2 py-1.5 ${collapsed ? "justify-center" : ""}`}>
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold shrink-0">{initials}</div>
            {!collapsed && (
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-medium text-foreground truncate">{displayName || "Usuário"}</span>
              </div>
            )}
            {!collapsed && (
              <button onClick={() => signOut()} className="p-1 rounded hover:bg-accent text-muted-foreground" title="Sair">
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </aside>
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 px-6 flex items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <CodeBox />
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
        <div className="flex-1 overflow-auto p-6 scrollbar-thin">{children}</div>
      </main>
    </div>
  );
}
