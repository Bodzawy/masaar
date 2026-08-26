import { de, type Dict } from "./de";
import { en } from "./en";

const dictionaries: Record<string, Dict> = { de, en };

export function getDictionary(locale: string): Dict {
  return dictionaries[locale] ?? de;
}

/** Resolve a dot-path key ("nav.overview") against the dictionary. */
export function translate(dict: Dict, key: string, vars?: Record<string, string | number>): string {
  let value = key.split(".").reduce<unknown>((acc, part) => {
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
