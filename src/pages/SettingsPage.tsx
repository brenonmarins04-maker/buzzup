import { useState } from "react";
import PeoplePage from "./PeoplePage";
import MembersPage from "./MembersPage";
import GeneralShortcutsSettings from "@/components/GeneralShortcutsSettings";
import { useIsMobile } from "@/hooks/use-mobile";

type Tab = "pessoas" | "acessos" | "atalhos";

export default function SettingsPage() {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<Tab>("pessoas");

  // "Atalhos gerais" não aparece nas configurações no mobile.
  const tabs: { v: Tab; label: string }[] = [
    { v: "pessoas", label: "Pessoas" },
    { v: "acessos", label: "Acessos" },
    ...(isMobile ? [] : [{ v: "atalhos" as Tab, label: "Atalhos gerais" }]),
  ];

  // Se por algum motivo a aba ativa for "atalhos" no mobile, volta para Pessoas.
  const activeTab: Tab = isMobile && tab === "atalhos" ? "pessoas" : tab;

  return (
    <div className="animate-fade-in space-y-0">
      <div className="flex items-center gap-1 border-b border-border mb-5">
        {tabs.map(t => (
          <button
            key={t.v}
            onClick={() => setTab(t.v)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === t.v
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "pessoas" ? <PeoplePage /> : activeTab === "acessos" ? <MembersPage /> : <GeneralShortcutsSettings />}
    </div>
  );
}
