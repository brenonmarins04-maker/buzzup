import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useData } from "@/contexts/DataContext";

function formatLastUpdate(value: string | null, compact = false): string {
  if (!value) return "Ainda não atualizado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Ainda não atualizado";
  if (compact) {
    return `${date.toLocaleDateString("pt-BR")} ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return `Atualizado em ${date.toLocaleDateString("pt-BR")} às ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

/** Atualiza a gamificação sob demanda para evitar consultas em cada ponto recebido. */
export default function GamificationRefreshButton() {
  const { refreshGamification, gamificationLastUpdatedAt, gamificationRefreshing } = useData();

  const refresh = async () => {
    const ok = await refreshGamification();
    if (ok) {
      window.dispatchEvent(new Event("buzzup:gamification-refresh"));
      toast.success("Gamificação atualizada.");
    }
    else if (!gamificationRefreshing) toast.error("Não foi possível atualizar a gamificação.");
  };

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span className="whitespace-nowrap text-[10px] font-medium text-muted-foreground" title={formatLastUpdate(gamificationLastUpdatedAt)}>
        <span className="sm:hidden">{formatLastUpdate(gamificationLastUpdatedAt, true)}</span>
        <span className="hidden sm:inline">{formatLastUpdate(gamificationLastUpdatedAt)}</span>
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={refresh}
        disabled={gamificationRefreshing}
        title="Atualizar gamificação"
        aria-label="Atualizar gamificação"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-primary"
      >
        <RefreshCw className={`h-4 w-4 ${gamificationRefreshing ? "animate-spin" : ""}`} />
      </Button>
    </div>
  );
}
