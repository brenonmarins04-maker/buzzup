import { useState, useEffect } from "react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { Megaphone, X, Settings, Trash2, Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export default function BroadcastBar() {
  const { broadcasts, deleteBroadcast } = useData();
  const { isAdmin, isOwner } = useAuth();
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const visible = broadcasts.filter(b => !dismissed[b.id] && !b.message.startsWith("__AREA_NAMES__:"));
  if (visible.length === 0) return null;

  const formatRemaining = (expiresAt: string) => {
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) return "expirando";
    const hours = Math.floor(ms / (1000 * 60 * 60));
    if (hours < 1) {
      const mins = Math.max(1, Math.floor(ms / (1000 * 60)));
      return `${mins} min`;
    }
    if (hours < 48) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  };

  return (
    <div className="flex flex-col gap-2 px-4 md:px-6 pt-3">
      {visible.map(b => (
        <div
          key={b.id}
          className="relative flex items-start gap-3 rounded-lg border-2 border-red-500 bg-gradient-to-r from-red-500/10 via-red-500/5 to-red-500/10 px-4 py-3 shadow-[0_0_0_1px_rgba(239,68,68,0.15),0_4px_18px_-4px_rgba(239,68,68,0.4)] animate-in fade-in slide-in-from-top-2"
        >
          <div className="shrink-0 mt-0.5 h-7 w-7 rounded-md bg-red-500 text-white flex items-center justify-center shadow-md">
            <Megaphone className="h-4 w-4" />
          </div>
          <p className="flex-1 text-sm md:text-base font-bold text-red-700 dark:text-red-300 leading-snug whitespace-pre-wrap break-words">
            {b.message}
          </p>
          {isOwner && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  title="Gerenciar mensagens gerais"
                  className="shrink-0 p-1 rounded-md text-red-600 hover:bg-red-500/15 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Settings className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0 overflow-hidden">
                <div className="px-3 py-2 border-b border-border bg-red-500/5 flex items-center gap-2">
                  <Megaphone className="h-3.5 w-3.5 text-red-600" />
                  <span className="text-xs font-bold uppercase tracking-wide text-red-700">Mensagens ativas</span>
                  <span className="ml-auto text-[10px] bg-red-500 text-white rounded-full px-1.5 py-0.5 font-bold">{broadcasts.length}</span>
                </div>
                <div className="max-h-80 overflow-auto">
                  {broadcasts.length === 0 ? (
                    <div className="px-3 py-6 text-xs text-muted-foreground text-center">Nenhuma mensagem ativa</div>
                  ) : broadcasts.map(item => (
                    <div key={item.id} className="px-3 py-2.5 border-b border-border last:border-0 flex items-start gap-2 hover:bg-accent/40 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground line-clamp-2 break-words">{item.message}</p>
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>Some em <span className="font-semibold text-red-600">{formatRemaining(item.expiresAt)}</span></span>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteBroadcast(item.id)}
                        title="Excluir"
                        className="shrink-0 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
          {isAdmin ? (
            <button
              onClick={() => deleteBroadcast(b.id)}
              title="Remover mensagem"
              className="shrink-0 p-1 rounded-md text-red-600 hover:bg-red-500/15 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => setDismissed(d => ({ ...d, [b.id]: true }))}
              title="Ocultar"
              className="shrink-0 p-1 rounded-md text-red-600/70 hover:bg-red-500/10 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}