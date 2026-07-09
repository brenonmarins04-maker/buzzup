import { getTodayBrasilia } from "@/lib/utils";

// Normaliza qualquer data para "YYYY-MM-DD" (fuso ignorado — é uma data de calendário).
// Aceita ISO ("2026-07-11" ou "2026-07-11T..."), BR ("11/07/2026") e afins.
// Isso evita falsos "atrasada": "11/07/2026" comparado como texto é menor que
// "2026-07-09" e marcaria como atrasada por engano.
export function normalizeToISODate(raw?: string | null): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); // ISO (com ou sem hora)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); // DD/MM/YYYY
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${mo}-${da}`;
  }
  return null;
}

// Uma demanda está atrasada quando não foi concluída e a data já passou (fuso de Brasília).
export function isDemandOverdue(item: { status: string; date?: string | null }, today: string = getTodayBrasilia()): boolean {
  if (item.status === "done") return false;
  const iso = normalizeToISODate(item.date);
  return !!iso && iso < today;
}

// Exibe a data de uma demanda como "DD/MM" de forma segura (sem "Invalid Date").
export function formatDemandDayMonth(raw?: string | null): string | null {
  const iso = normalizeToISODate(raw);
  if (!iso) return null;
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}
