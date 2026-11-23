import { en, type MessageKey } from "./en";
import { it } from "./it";

export type Locale = "en" | "it";
export const LOCALES: Locale[] = ["en", "it"];
export const LOCALE_LABELS: Record<Locale, string> = { en: "English", it: "Italiano" };

const dictionaries: Record<Locale, Record<MessageKey, string>> = { en, it };

export function normalizeLocale(value: string | null | undefined): Locale {
  return value === "it" ? "it" : "en";
}

/** Translate a key; `{name}` placeholders are filled from params. */
export type Translator = (key: MessageKey, params?: Record<string, string | number>) => string;

export function getTranslator(locale: string | null | undefined): Translator {
  const dict = dictionaries[normalizeLocale(locale)];
  return (key, params) => {
    // Plurals: with count === 1, a "<key>.one" variant wins when it exists.
    const one = params?.count === 1 ? (`${key}.one` as MessageKey) : null;
    let s = (one && (dict[one] ?? en[one])) || dict[key] || en[key] || key;
    if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
}

export type { MessageKey };
