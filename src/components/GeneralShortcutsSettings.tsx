import { useEffect, useState } from "react";
import { ExternalLink, Plus, Save, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import type { GeneralShortcut } from "@/contexts/DataContext";
import { getShortcutIcon, SHORTCUT_ICON_OPTIONS } from "@/lib/generalShortcuts";

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `shortcut-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function emptyShortcut(): GeneralShortcut {
  return { id: makeId(), label: "", url: "", icon: "link" };
}

function normalizeUrl(url: string) {
  const value = url.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

export default function GeneralShortcutsSettings() {
  const { generalShortcuts, saveGeneralShortcuts } = useData();
  const { isAdmin, isOwner } = useAuth();
  const canEdit = isAdmin || isOwner;
  const [items, setItems] = useState<GeneralShortcut[]>(generalShortcuts);

  useEffect(() => {
    setItems(generalShortcuts);
  }, [generalShortcuts]);

  const updateItem = (id: string, patch: Partial<GeneralShortcut>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item));
  };

  const save = async () => {
    await saveGeneralShortcuts(items.map(item => ({ ...item, url: normalizeUrl(item.url) })));
  };

  return (
    <div className="space-y-5">
      <div className="glass-panel rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <h1 className="text-lg font-bold text-foreground">Atalhos gerais</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure links rápidos como Canva, Drive, Marketing, Vendas e outros acessos úteis.
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => setItems(prev => [...prev, emptyShortcut()])}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/15 transition-colors"
            >
              <Plus className="h-4 w-4" /> Novo atalho
            </button>
          )}
        </div>

        {!canEdit && (
          <div className="mb-4 rounded-xl border border-border bg-muted/35 px-4 py-3 text-sm text-muted-foreground">
            Apenas diretores e owners podem editar os atalhos. Assessores conseguem visualizar e abrir os links.
          </div>
        )}

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-white/45 px-5 py-10 text-center">
            <ExternalLink className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-semibold text-foreground">Nenhum atalho criado ainda.</p>
            <p className="text-xs text-muted-foreground mt-1">Adicione os principais links usados pelo workspace.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {items.map(item => {
              const Icon = getShortcutIcon(item.icon);
              return (
                <div key={item.id} className="rounded-2xl border border-border/70 bg-white/65 p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_150px] gap-2 flex-1 min-w-0">
                      <input
                        value={item.label}
                        onChange={e => updateItem(item.id, { label: e.target.value })}
                        disabled={!canEdit}
                        placeholder="Nome do atalho"
                        className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary disabled:opacity-70"
                      />
                      <input
                        value={item.url}
                        onChange={e => updateItem(item.id, { url: e.target.value })}
                        disabled={!canEdit}
                        placeholder="https://..."
                        className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary disabled:opacity-70"
                      />
                      <select
                        value={item.icon}
                        onChange={e => updateItem(item.id, { icon: e.target.value })}
                        disabled={!canEdit}
                        className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary disabled:opacity-70"
                      >
                        {SHORTCUT_ICON_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setItems(prev => prev.filter(shortcut => shortcut.id !== item.id))}
                        className="h-10 w-10 rounded-xl border border-destructive/20 text-destructive hover:bg-destructive/10 flex items-center justify-center shrink-0"
                        title="Remover atalho"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {canEdit && (
          <div className="flex justify-end pt-5">
            <button
              type="button"
              onClick={save}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/15 hover:bg-primary/90 transition-colors"
            >
              <Save className="h-4 w-4" /> Salvar atalhos
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
