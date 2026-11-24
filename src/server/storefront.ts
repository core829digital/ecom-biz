import "server-only";
import { isSafeRelativePath } from "@/lib/safe-path";
import { cache } from "react";
import { notFound } from "next/navigation";
import { resolveStore, storeBase, storePublicUrl } from "@/lib/tenant";
import { effectiveLimits, storeOperational, storeOwner } from "@/server/plans";
import { clampTheme, type ThemeCapabilities } from "@/lib/theme-capabilities";
import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/staff";
import { parseTheme, themeDraft, type Theme } from "@/lib/theme";
import { getTranslator } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";

/** Everything a storefront page needs, memoized per request. 404s for unknown/inactive stores. */
export const loadStorefront = cache(async (siteKey: string) => {
  const store = await resolveStore(siteKey);
  if (!store) notFound();
  const base = await storeBase(siteKey);
  const [preview, caps] = await Promise.all([previewTheme(store), storeThemeCapabilities(store.id)]);
  const theme = clampTheme(preview ?? parseTheme(store.theme), caps);
  const t = getTranslator(store.locale);
  return {
    store,
    base,
    theme,
    /** True while a merchant looks at unpublished site-editor changes. */
    preview: !!preview,
    t,
    locale: store.locale,
    operational: await storeOperational(store),
    publicUrl: await storePublicUrl(store),
    money: (cents: number) => formatMoney(cents, store.currency, store.locale),
    href: (path: string) => sfHref(base, path),
  };
});

export const PREVIEW_COOKIE = "sf_preview";

/** Site-editor features the store owner's plan includes (animations, custom CSS). */
export async function storeThemeCapabilities(storeId: string): Promise<ThemeCapabilities> {
  const owner = await storeOwner(storeId);
  const { motion, customCss } = effectiveLimits(owner);
  return { motion, customCss };
}

/**
 * The unpublished draft theme, only for the store's own staff, only on the platform host
 * (path-based /sites/<slug>, where the staff session cookie exists) and only after the
 * editor set the preview cookie. Visitors on the store's own domain can never see it.
 */
async function previewTheme(store: { id: string; theme: unknown }): Promise<Theme | null> {
  const [jar, h] = await Promise.all([cookies(), headers()]);
  if (jar.get(PREVIEW_COOKIE)?.value !== store.id || h.has("x-store-base")) return null;
  const user = await getCurrentUser();
  if (!user) return null;
  const member = user.isPlatformAdmin || (await db.membership.count({ where: { userId: user.id, storeId: store.id } })) > 0;
  if (!member) return null;
  return themeDraft(store.theme) ?? parseTheme(store.theme);
}

export type Storefront = Awaited<ReturnType<typeof loadStorefront>>;

/** Prefix internal paths with the store base; allow only safe external schemes. */
export function sfHref(base: string, url: string): string {
  if (url.startsWith("/")) return !isSafeRelativePath(url) ? "#" : `${base}${url === "/" && base ? "" : url}` || "/";
  if (/^(https?:|mailto:|tel:)/i.test(url)) return url;
  return "#";
}
