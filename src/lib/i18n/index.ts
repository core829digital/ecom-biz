import { en, type MessageKey } from "./en";
import { it } from "./it";

export type Locale = "en" | "it";
export const LOCALES: Locale[] = ["en", "it"];
export const LOCALE_LABELS: Record<Locale, string> = { en: "English", it: "Italiano" };

const dictionaries: Record<Locale, Record<MessageKey, string>> = { en, it };

export function normalizeLocale(value: string | null | undefined): Locale {
  return value === "it" ? "it" : "en";
}

export type Translator = (key: MessageKey, params?: Record<string, string | number>) => string;

export function getTranslator(locale: string | null | undefined): Translator {
  const dict = dictionaries[normalizeLocale(locale)];
  return (key, params) => {
    let s = dict[key] ?? en[key] ?? key;
    if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
}

export type { MessageKey };
