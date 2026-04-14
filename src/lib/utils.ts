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
