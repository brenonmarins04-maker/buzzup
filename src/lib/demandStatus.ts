import { getTodayBrasilia } from "@/lib/utils";

// Uma demanda está atrasada quando não foi concluída e a data já passou (fuso de Brasília).
export function isDemandOverdue(item: { status: string; date?: string | null }, today: string = getTodayBrasilia()): boolean {
  return item.status !== "done" && !!item.date && item.date < today;
}
