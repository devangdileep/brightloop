import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | string | null | undefined, currency = "USD") {
  const amount = typeof value === "string" ? Number(value) : (value ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatCompactCurrency(value: number | string | null | undefined, currency = "USD") {
  const amount = typeof value === "string" ? Number(value) : (value ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatNumber(value: number | string | null | undefined) {
  const amount = typeof value === "string" ? Number(value) : (value ?? 0);
  return new Intl.NumberFormat("en-US").format(Number.isFinite(amount) ? amount : 0);
}

export function formatPercent(value: number, digits = 1) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

export function formatDate(value: string | Date | null | undefined, pattern = "MMM d, yyyy") {
  if (!value) return "—";
  const date = typeof value === "string" ? parseISO(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, pattern);
}

export function fromNow(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? parseISO(value) : value;
  return formatDistanceToNow(date, { addSuffix: true });
}

export function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function monthKey(date: Date) {
  return format(date, "yyyy-MM");
}

export function safeRedirect(path: string | null | undefined, fallback = "/dashboard") {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return fallback;
  return path;
}

export const CURRENCY = "USD";

export function intervalLabel(interval: string, count = 1) {
  const unit = interval === "monthly" ? "month" : interval === "quarterly" ? "quarter" : "year";
  return count > 1 ? `${count} ${unit}s` : `per ${unit}`;
}

export function addInterval(date: Date, interval: string, count = 1) {
  const next = new Date(date);
  if (interval === "monthly") next.setMonth(next.getMonth() + count);
  else if (interval === "quarterly") next.setMonth(next.getMonth() + 3 * count);
  else next.setFullYear(next.getFullYear() + count);
  return next;
}

export function monthlyValue(amount: number, interval: string, count = 1) {
  const months = interval === "monthly" ? 1 : interval === "quarterly" ? 3 : 12;
  return (amount * 1) / (months * Math.max(count, 1));
}
