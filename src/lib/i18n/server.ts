import "server-only";
import { cookies } from "next/headers";

export type Locale = "en" | "ar";
export const LOCALES: Locale[] = ["en", "ar"];
export const DEFAULT_LOCALE: Locale = "en";
const COOKIE = "dp_locale";

export function isLocale(v: string | undefined): v is Locale {
  return v === "en" || v === "ar";
}

export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  const v = jar.get(COOKIE)?.value;
  return isLocale(v) ? v : DEFAULT_LOCALE;
}

export async function setLocaleCookie(locale: Locale): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}

export function dirFor(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}
