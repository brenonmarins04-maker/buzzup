import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getNowBrasilia(): Date {
  const now = new Date();
  const brasiliaStr = now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
  return new Date(brasiliaStr);
}

export function getTodayBrasilia(): string {
  const d = getNowBrasilia();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Normaliza texto para busca: tira acentos e caixa.
 * Assim "Luisa" acha "Luísa", e vice-versa — ninguém precisa lembrar de
 * digitar o acento certo para achar uma pessoa.
 */
export function normalizeForSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Procura todas as palavras digitadas em qualquer parte do texto, ignorando
 * acentos e caixa. Assim, "Gabriel P" encontra "Gabriel Rodrigues Pontes",
 * sem exigir que os sobrenomes sejam digitados na ordem original.
 */
export function matchesSearch(text: string | null | undefined, term: string): boolean {
  const query = normalizeForSearch(term);
  if (!query) return true;

  const words = normalizeForSearch(text ?? "").split(/\s+/).filter(Boolean);
  return query.split(/\s+/).every(word => words.some(candidate => candidate.includes(word)));
}
