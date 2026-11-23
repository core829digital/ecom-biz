import "server-only";
import { isSafeRelativePath } from "@/lib/safe-path";
import { cache } from "react";
import { notFound } from "next/navigation";
import { resolveStore, storeBase, storePublicUrl } from "@/lib/tenant";
import { storeOperational } from "@/server/plans";
import { parseTheme } from "@/lib/theme";
import { getTranslator } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";

/** Everything a storefront page needs, memoized per request. 404s for unknown/inactive stores. */
export const loadStorefront = cache(async (siteKey: string) => {
  const store = await resolveStore(siteKey);
  if (!store) notFound();
  const base = await storeBase(siteKey);
  const theme = parseTheme(store.theme);
  const t = getTranslator(store.locale);
  return {
    store,
    base,
    theme,
    t,
    locale: store.locale,
    operational: await storeOperational(store),
    publicUrl: await storePublicUrl(store),
    money: (cents: number) => formatMoney(cents, store.currency, store.locale),
    href: (path: string) => sfHref(base, path),
  };
});

export type Storefront = Awaited<ReturnType<typeof loadStorefront>>;

/** Prefix internal paths with the store base; allow only safe external schemes. */
export function sfHref(base: string, url: string): string {
  if (url.startsWith("/")) return !isSafeRelativePath(url) ? "#" : `${base}${url === "/" && base ? "" : url}` || "/";
  if (/^(https?:|mailto:|tel:)/i.test(url)) return url;
  return "#";
}
