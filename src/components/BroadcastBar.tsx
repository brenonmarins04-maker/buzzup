import { useState } from "react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { Megaphone, X } from "lucide-react";

export default function BroadcastBar() {
  const { broadcasts, deleteBroadcast } = useData();
  const { isAdmin } = useAuth();
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});

  const visible = broadcasts.filter(b => !dismissed[b.id]);
  if (visible.length === 0) return null;

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