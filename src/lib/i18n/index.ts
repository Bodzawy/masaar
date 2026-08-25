import { en, type Dict } from "./en";
import { ar } from "./ar";

const dictionaries: Record<string, Dict> = { en, ar };

export function getDictionary(locale: string): Dict {
  return dictionaries[locale] ?? en;
}

/** Resolve a dot-path key ("nav.overview") against the dictionary. */
export function translate(dict: Dict, key: string, vars?: Record<string, string | number>): string {
  const value = key.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[part];
    return undefined;
  }, dict);
  let out = typeof value === "string" ? value : key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  }
  return out;
}

export type Translator = (key: string, vars?: Record<string, string | number>) => string;
