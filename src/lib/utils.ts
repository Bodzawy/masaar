import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(cents / 100);
}

// Deterministische Formatierung (Server & Client identisch) – Produktzeitzone Mitteleuropa.
const APP_TIME_ZONE = "Europe/Berlin";

export function formatDate(d: Date | string, locale = "de-DE"): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: APP_TIME_ZONE }).format(new Date(d));
}

export function formatDateTime(d: Date | string, locale = "de-DE"): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: APP_TIME_ZONE }).format(new Date(d));
}

export function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}
