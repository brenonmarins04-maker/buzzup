import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AREAS_DEFAULT, getAreaLabel, getAreaColor } from "@/lib/areas";
import { FileText, Save, Pencil } from "lucide-react";
import { toast } from "sonner";

type SummaryRow = {
  summaries: Record<string, string>;
  generated_at: string;
  generated_by: string | null;
};

export default function SummarySection() {
  const { activeWorkspaceId, isAdmin, user } = useAuth();

  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selectedArea, setSelectedArea] = useState<string>(AREAS_DEFAULT[0].key);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Carrega do banco e assina Realtime
  useEffect(() => {
    if (!activeWorkspaceId) return;
    let cancelled = false;

    const load = async () => {
      const { data } = await (supabase.from("workspace_summaries") as any)
        .select("summaries")
        .eq("workspace_id", activeWorkspaceId)
        .maybeSingle();
      if (!cancelled) {
        setSummaries((data?.summaries && typeof data.summaries === "object") ? data.summaries : {});
        setLoading(false);
      }
    };
    load();

    let ch: ReturnType<typeof supabase.channel> | null = null;
    try {
      ch = supabase
        .channel(`summary-${activeWorkspaceId}-${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", {
          event: "*", schema: "public",
          table: "workspace_summaries",
          filter: `workspace_id=eq.${activeWorkspaceId}`,
        }, (payload) => {
          const r = payload.new as SummaryRow | null;
          if (r?.summaries && typeof r.summaries === "object") {
            setSummaries(r.summaries);
          }
        })
        .subscribe();
    } catch { ch = null; }

    return () => { cancelled = true; if (ch) supabase.removeChannel(ch); };
  }, [activeWorkspaceId]);

  // Ao trocar área, sai do modo edição
  useEffect(() => {
    setEditing(false);
    setDraft("");
  }, [selectedArea]);

  // Foca textarea ao entrar em edição
  useEffect(() => {
    if (editing) {
      setDraft(summaries[selectedArea] ?? "");
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [editing]);

  const save = async () => {
    if (!activeWorkspaceId || !user) return;
    setSaving(true);
    const newSummaries = { ...summaries, [selectedArea]: draft.trim() };

    const { error } = await (supabase.from("workspace_summaries") as any).upsert({
      workspace_id: activeWorkspaceId,
      summaries: newSummaries,
      generated_at: new Date().toISOString(),
      generated_by: user.id,
    }, { onConflict: "workspace_id" });

    if (error) {
      toast.error("Erro ao salvar. Verifique o SQL da tabela.");
    } else {
      setSummaries(newSummaries);
      toast.success("Atualização salva!");
      setEditing(false);
    }
    setSaving(false);
  };

  const cancel = () => { setEditing(false); setDraft(""); };

  const areaColor = getAreaColor(selectedArea);
  const currentText = summaries[selectedArea] ?? "";

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" /> Atualizações das Áreas
        </h2>
        {isAdmin && !editing && !loading && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <Pencil className="h-3 w-3" /> Editar
          </button>
        )}
      </div>

      {/* Seletor de área — sempre visível */}
      <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto scrollbar-none">
        {AREAS_DEFAULT.map(a => {
          const color = getAreaColor(a.key);
          const label = getAreaLabel(a.key) || a.label;
          const active = selectedArea === a.key;
          const hasContent = !!(summaries[a.key]?.trim());
          return (
            <button
              key={a.key}
              onClick={() => setSelectedArea(a.key)}
              className="shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold border transition-all flex items-center gap-1"
              style={active
                ? { backgroundColor: `${color}22`, color, borderColor: `${color}88` }
                : { backgroundColor: "transparent", color: "var(--muted-foreground)", borderColor: "var(--border)" }
              }
            >
              {label}
              {hasContent && (
                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: active ? color : "var(--muted-foreground)", opacity: active ? 1 : 0.5 }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Conteúdo */}
      <div className="border-t border-border">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : editing && isAdmin ? (
          /* Modo edição */
          <div className="p-4 flex flex-col gap-3">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder={`Escreva o que está acontecendo em ${getAreaLabel(selectedArea) || AREAS_DEFAULT.find(a => a.key === selectedArea)?.label}…`}
              rows={5}
              className="w-full text-sm rounded-lg border border-input bg-background px-3 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 resize-none"
              style={{ "--tw-ring-color": areaColor } as any}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={cancel}
                disabled={saving}
                className="px-3 py-1.5 rounded-md text-xs font-medium border border-border text-muted-foreground hover:bg-accent transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white transition-colors"
                style={{ backgroundColor: areaColor }}
              >
                <Save className="h-3 w-3" />
                {saving ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        ) : currentText ? (
          /* Modo leitura com conteúdo */
          <div
            className="mx-4 my-3 rounded-lg p-3"
            style={{ backgroundColor: `${areaColor}10`, borderLeft: `3px solid ${areaColor}` }}
          >
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{currentText}</p>
          </div>
        ) : (
          /* Sem conteúdo */
          <div className="flex flex-col items-center gap-1.5 py-6 text-center px-4">
            <p className="text-xs text-muted-foreground">
              {isAdmin
                ? `Nenhuma atualização para ${getAreaLabel(selectedArea) || AREAS_DEFAULT.find(a => a.key === selectedArea)?.label} ainda. Clique em "Editar" para escrever.`
                : `Nenhuma atualização para ${getAreaLabel(selectedArea) || AREAS_DEFAULT.find(a => a.key === selectedArea)?.label} no momento.`
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
