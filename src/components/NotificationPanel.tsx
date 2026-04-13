import { useData } from "@/contexts/DataContext";
import { X, AlertTriangle, AlertCircle, Info } from "lucide-react";

const typeIcon = {
  danger: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const typeColor = {
  danger: "text-destructive",
  warning: "text-status-in-progress",
  info: "text-status-published",
};

export default function NotificationPanel({ onClose }: { onClose: () => void }) {
  const { notifications, markAllNotificationsRead } = useData();

  return (
    <div className="absolute right-2 top-12 md:top-14 z-50 w-80 max-h-96 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Notificações</h3>
        <div className="flex items-center gap-2">
          <button onClick={markAllNotificationsRead} className="text-[10px] text-muted-foreground hover:text-foreground">Marcar todas como lidas</button>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded"><X className="h-3 w-3" /></button>
        </div>
      </div>
      <div className="overflow-y-auto max-h-80 scrollbar-thin">
        {notifications.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground text-center">Nenhuma notificação</p>
        ) : (
          notifications.map(n => {
            const Icon = typeIcon[n.type];
            return (
              <div key={n.id} className={`flex items-start gap-3 p-3 border-b border-border last:border-0 ${!n.read ? "bg-accent/30" : ""}`}>
                <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${typeColor[n.type]}`} />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground">{n.title}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{n.message}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
