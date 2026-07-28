import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePendingJoinCount } from "@/hooks/usePendingJoinCount";
import {
  Settings, Trophy, Users, FolderKanban, ExternalLink, BarChart2, Shield, ChevronRight,
  type LucideIcon,
} from "lucide-react";

type ConfigItem = {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
  adminOnly?: boolean;
  ownerOnly?: boolean;
  badge?: number;
};

export default function ConfigHubPage() {
  const { isAdmin, isOwner, role } = useAuth();
  const pendingJoinCount = usePendingJoinCount();

  const items: ConfigItem[] = [
    { to: "/gamification", label: "Gameficação", description: "Pontue, defina apelidos, ações rápidas e histórico.", icon: Trophy, color: "#EF9F27", adminOnly: true },
    { to: "/people", label: "Pessoas", description: "Diretório de pessoas, cargos e último acesso.", icon: Users, color: "#00B4D8" },
    { to: "/areas-times", label: "Áreas e Times", description: "Veja e organize as áreas e os times do workspace.", icon: FolderKanban, color: "#8B5CF6" },
    { to: "/shortcuts", label: "Atalhos gerais", description: "Links importantes do workspace em um só lugar.", icon: ExternalLink, color: "#10B981", adminOnly: true },
    { to: "/reports", label: "Relatórios", description: "Entradas no BuzzUp, tarefas concluídas e desempenho.", icon: BarChart2, color: "#0EA5E9", adminOnly: true },
    { to: "/members", label: "Convites", description: "Pedidos de entrada no workspace para aprovar.", icon: Shield, color: "#EF4444", ownerOnly: true, badge: pendingJoinCount },
  ];

  const visible = items.filter(item => {
    if (item.ownerOnly) return isOwner;
    if (item.adminOnly) return isAdmin;
    return true;
  });
  const roleLabel = role === "owner" ? "Owner" : role === "admin" ? "Diretor" : role === "leader" ? "Líder" : "Assessor";

  return (
    <div className="animate-fade-in space-y-5">
      <div className="page-hero rounded-2xl px-5 py-4 flex items-center gap-3">
        <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Configurações</h1>
          <p className="text-xs text-muted-foreground">Opções disponíveis para o seu acesso de {roleLabel}.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {visible.map(item => (
          <Link
            key={item.to}
            to={item.to}
            className="group hover-lift relative glass-panel-soft rounded-2xl p-4 flex items-start gap-3 hover:border-primary/40 transition-all"
          >
            <div
              className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${item.color}1a`, color: item.color }}
            >
              <item.icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground truncate">{item.label}</span>
                {item.badge ? (
                  <span className="h-5 min-w-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary shrink-0 mt-1 transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}
