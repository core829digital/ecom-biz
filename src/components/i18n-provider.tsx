"use client";

import { createContext, useContext, useMemo } from "react";
import { getTranslator, type Locale, type Translator } from "@/lib/i18n";

const I18nContext = createContext<Locale>("en");

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <I18nContext.Provider value={locale}>{children}</I18nContext.Provider>;
}

export function useT(): Translator {
  const locale = useContext(I18nContext);
  return useMemo(() => getTranslator(locale), [locale]);
}

export function useLocale(): Locale {
  return useContext(I18nContext);
}
