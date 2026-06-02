import { useData } from "@/contexts/DataContext";

interface Props {
  selectedId: string | null;
  onChange: (teamId: string | null) => void;
}

export default function TeamSelector({ selectedId, onChange }: Props) {
  const { teams } = useData();
  if (teams.length === 0) {
    return <p className="text-xs text-muted-foreground">Nenhuma time cadastrada.</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      <button type="button" onClick={() => onChange(null)}
        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${selectedId === null ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input text-muted-foreground hover:bg-accent"}`}>
        Sem time
      </button>
      {teams.map(t => (
        <button key={t.id} type="button" onClick={() => onChange(t.id)}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${selectedId === t.id ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input text-muted-foreground hover:bg-accent"}`}>
          {t.name}
        </button>
      ))}
    </div>
  );
}