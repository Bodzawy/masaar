import "server-only";
import { cookies } from "next/headers";

export type Locale = "de" | "en";
export const LOCALES: Locale[] = ["de", "en"];
export const DEFAULT_LOCALE: Locale = "de";
const COOKIE = "dp_locale";

export function isLocale(v: string | undefined): v is Locale {
  return v === "de" || v === "en";
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

/**
 * The UI shell is German-first and therefore always LTR.
 * Arabic CONTENT is rendered in dedicated RTL islands via <ArabicText>.
 */
export function dirFor(_locale: Locale): "ltr" {
  return "ltr";
}
