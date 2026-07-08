import {
  BarChart3,
  Calendar,
  Cloud,
  ExternalLink,
  FileText,
  Megaphone,
  MessageCircle,
  Palette,
  ShoppingCart,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Broadcast, GeneralShortcut } from "@/contexts/DataContext";

export const GENERAL_SHORTCUTS_PREFIX = "__GENERAL_SHORTCUTS__:";

function makeShortcutId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `shortcut-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const SHORTCUT_ICON_OPTIONS: { value: string; label: string; Icon: LucideIcon }[] = [
  { value: "palette", label: "Canva / Design", Icon: Palette },
  { value: "cloud", label: "Drive / Arquivos", Icon: Cloud },
  { value: "megaphone", label: "Marketing", Icon: Megaphone },
  { value: "sales", label: "Vendas", Icon: ShoppingCart },
  { value: "users", label: "Pessoas", Icon: Users },
  { value: "chart", label: "Relatórios", Icon: BarChart3 },
  { value: "calendar", label: "Calendário", Icon: Calendar },
  { value: "document", label: "Documento", Icon: FileText },
  { value: "chat", label: "Comunicação", Icon: MessageCircle },
  { value: "link", label: "Link geral", Icon: ExternalLink },
];

export function getShortcutIcon(icon?: string | null) {
  return SHORTCUT_ICON_OPTIONS.find(option => option.value === icon)?.Icon || ExternalLink;
}

export function parseGeneralShortcuts(broadcasts: Broadcast[]): GeneralShortcut[] {
  const config = broadcasts.find(b => b.message.startsWith(GENERAL_SHORTCUTS_PREFIX));
  if (!config) return [];

  try {
    const payload = JSON.parse(config.message.slice(GENERAL_SHORTCUTS_PREFIX.length));
    if (!Array.isArray(payload)) return [];
    return payload
      .map((item): GeneralShortcut | null => {
        const id = String(item?.id || makeShortcutId());
        const label = String(item?.label || "").trim();
        const url = String(item?.url || "").trim();
        const icon = String(item?.icon || "link");
        if (!label || !url) return null;
        return { id, label, url, icon };
      })
      .filter(Boolean) as GeneralShortcut[];
  } catch {
    return [];
  }
}

export function serializeGeneralShortcuts(shortcuts: GeneralShortcut[]) {
  const payload = shortcuts
    .map(item => ({
      id: item.id,
      label: item.label.trim(),
      url: item.url.trim(),
      icon: item.icon || "link",
    }))
    .filter(item => item.label && item.url);

  return `${GENERAL_SHORTCUTS_PREFIX}${JSON.stringify(payload)}`;
}
