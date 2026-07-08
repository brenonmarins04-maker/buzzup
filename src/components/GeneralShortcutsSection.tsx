import { ExternalLink } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { getShortcutIcon } from "@/lib/generalShortcuts";

export default function GeneralShortcutsSection() {
  const { generalShortcuts } = useData();

  return (
    <section className="glass-panel rounded-2xl p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Atalhos gerais</h2>
          <p className="text-xs text-muted-foreground mt-1">Links importantes do workspace em um só lugar.</p>
        </div>
      </div>

      {generalShortcuts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white/45 px-4 py-6 text-center">
          <p className="text-sm font-medium text-foreground">Nenhum atalho configurado.</p>
          <p className="text-xs text-muted-foreground mt-1">Diretores podem adicionar atalhos em Configurações.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {generalShortcuts.map(shortcut => {
            const Icon = getShortcutIcon(shortcut.icon);
            return (
              <a
                key={shortcut.id}
                href={shortcut.url}
                target="_blank"
                rel="noreferrer"
                className="hover-lift group rounded-2xl border border-border/70 bg-white/65 px-3 py-4 min-h-[104px] flex flex-col justify-between gap-3 transition-all hover:border-primary/35 hover:bg-white/85 hover:shadow-lg hover:shadow-primary/10"
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{shortcut.label}</p>
                  <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground group-hover:text-primary">
                    Abrir <ExternalLink className="h-3 w-3" />
                  </span>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </section>
  );
}
