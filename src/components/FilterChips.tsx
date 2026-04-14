interface FilterOption {
  value: string;
  label: string;
}

interface FilterChipsProps {
  options: FilterOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  label?: string;
}

export default function FilterChips({ options, selected, onChange, label }: FilterChipsProps) {
  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {label && <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mr-1">{label}</span>}
      {options.map((opt) => {
        const active = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            onClick={() => toggle(opt.value)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
              active
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
