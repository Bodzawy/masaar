"use client";

import { createContext, useContext } from "react";
import type { Dict } from "@/lib/i18n/de";
import { translate, type Translator } from "@/lib/i18n";

const I18nContext = createContext<{ locale: string; dict: Dict }>({ locale: "de", dict: {} as Dict });

export function I18nProvider({ locale, dict, children }: { locale: string; dict: Dict; children: React.ReactNode }) {
  return <I18nContext.Provider value={{ locale, dict }}>{children}</I18nContext.Provider>;
}

/** Client-side translator bound to the active dictionary. */
export function useT(): Translator & { locale: string } {
  const { dict, locale } = useContext(I18nContext);
  const t = (key: string, vars?: Record<string, string | number>) => translate(dict, key, vars);
  t.locale = locale;
  return t;
}
