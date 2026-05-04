import { useState, useCallback } from "react";

const STORAGE_KEY = "formMemory";

type FormMemory = {
  lastTeam: string;
  lastChannel: string;
  lastCategory: string;
  lastTeamId: string | null;
};

function getMemory(): FormMemory {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { lastTeam: "", lastChannel: "", lastCategory: "", lastTeamId: null };
}

function setMemory(partial: Partial<FormMemory>) {
  const current = getMemory();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...partial }));
}

export function useFormMemory() {
  const [memory, setLocalMemory] = useState<FormMemory>(getMemory);

  const remember = useCallback((partial: Partial<FormMemory>) => {
    setMemory(partial);
    setLocalMemory(prev => ({ ...prev, ...partial }));
  }, []);

  return { memory, remember };
}
