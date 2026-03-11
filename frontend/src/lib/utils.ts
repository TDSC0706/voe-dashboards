import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number | null | undefined, decimals = 1): string {
  if (n == null) return "—";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatCurrency(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

export function formatDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  const iso = d.endsWith("Z") || d.includes("+") ? d : d + "Z";
  return new Date(iso).toLocaleString("pt-BR");
}

export function formatHours(h: number | null | undefined): string {
  if (h == null) return "0,00h";
  return Number(h).toFixed(2).replace(".", ",") + "h";
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    CREATED: "bg-gray-100 text-gray-700",
    PLANNING: "bg-blue-100 text-blue-700",
    ONGOING: "bg-green-100 text-green-700",
    PAUSED: "bg-yellow-100 text-yellow-700",
    COMPLETED: "bg-emerald-100 text-emerald-700",
    CANCELED: "bg-red-100 text-red-700",
    IN_PROGRESS: "bg-blue-100 text-blue-700",
    TO_DO: "bg-purple-100 text-purple-700",
    BACKLOG: "bg-gray-100 text-gray-700",
    ON_TRACK: "bg-green-100 text-green-700",
    AT_RISK: "bg-yellow-100 text-yellow-700",
    OVERDUE: "bg-red-100 text-red-700",
    DONE: "bg-emerald-100 text-emerald-700",
    OK: "bg-green-100 text-green-700",
    OVERLOADED: "bg-yellow-100 text-yellow-700",
    CRITICAL: "bg-red-100 text-red-700",
  };
  return map[status] || "bg-gray-100 text-gray-700";
}

export function riskColor(score: number): string {
  if (score >= 60) return "text-red-600";
  if (score >= 30) return "text-yellow-600";
  return "text-green-600";
}
