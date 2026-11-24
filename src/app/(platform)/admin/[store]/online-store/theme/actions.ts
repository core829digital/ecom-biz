"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { fail, ok, type ActionState } from "@/lib/action";
import { getPlatformT } from "@/lib/i18n/server";
import { FONTS, parseTheme, themeDraft, type Theme } from "@/lib/theme";
import { audit } from "@/server/audit";
import { clampTheme } from "@/lib/theme-capabilities";
import { storeThemeCapabilities } from "@/server/storefront";
import type { MessageKey } from "@/lib/i18n/en";

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Strict checks on what the editor sent, so merchants get errors instead of silent fallbacks,
 * and so a store can only reference its own images, collections and products.
 */
async function validate(storeId: string, raw: Record<string, unknown>, t: (k: MessageKey) => string) {
  const errors: Record<string, string> = {};
  for (const k of ["primaryColor", "accentColor", "backgroundColor", "textColor"]) {
    if (k in raw && (typeof raw[k] !== "string" || !HEX.test(raw[k] as string))) errors[k] = t("theme.error.color");
  }
  if (!(String(raw.font) in FONTS)) errors.font = t("products.error.invalid");
  // Plan limits (animations, custom CSS) are enforced here, not only hidden in the UI.
  const theme = clampTheme(parseTheme(raw), await storeThemeCapabilities(storeId));

  const images = [theme.logoUrl, theme.faviconUrl, theme.heroImageUrl];
  const collectionIds: string[] = [];
  const productIds: string[] = [];
  for (const s of theme.sections) {
    if (s.type === "hero" || s.type === "image-text") images.push(s.imageUrl);
    if (s.type === "featured-products" && s.collectionId) collectionIds.push(s.collectionId);
    if (s.type === "container") {
      for (const b of s.blocks) {
        if (b.type === "image") images.push(b.url);
        if (b.type === "product" && b.productId) productIds.push(b.productId);
      }
    }
  }
  const local = [...new Set(images.filter((u) => u && !u.startsWith("https://")))];
  const unique = (a: string[]) => [...new Set(a)];
  const [ownedFiles, ownedCols, ownedProducts] = await Promise.all([
    local.length ? db.storedFile.count({ where: { storeId, url: { in: local } } }) : 0,
    collectionIds.length ? db.collection.count({ where: { storeId, id: { in: unique(collectionIds) } } }) : 0,
    productIds.length ? db.product.count({ where: { storeId, id: { in: unique(productIds) } } }) : 0,
  ]);
  if (ownedFiles !== local.length) errors.images = t("products.error.image");
  if (ownedCols !== unique(collectionIds).length || ownedProducts !== unique(productIds).length) errors.sections = t("products.error.invalid");
  return { theme, errors };
}

function readPayload(fd: FormData): Record<string, unknown> | null {
  try {
    const v = JSON.parse(String(fd.get("payload") ?? "{}"));
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

const asJson = (t: Theme) => JSON.parse(JSON.stringify(t)) as Prisma.InputJsonObject;

/** Autosave from the editor: stores the work-in-progress next to the published theme. */
export async function saveThemeDraftAction(slug: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  const raw = readPayload(fd);
  if (!raw) return fail(t("validation.fixErrors"));
  const { theme, errors } = await validate(store.id, raw, t);
  if (Object.keys(errors).length) return fail(t("validation.fixErrors"), errors);
  const current = (store.theme && typeof store.theme === "object" ? store.theme : {}) as Prisma.InputJsonObject;
  await db.store.update({ where: { id: store.id }, data: { theme: { ...current, draft: asJson(theme) } } });
  return ok(t("theme.draftSaved"));
}

/** Makes the draft live for every visitor. */
export async function publishThemeAction(slug: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store, user } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  const raw = readPayload(fd);
  if (!raw) return fail(t("validation.fixErrors"));
  const { theme, errors } = await validate(store.id, raw, t);
  if (Object.keys(errors).length) return fail(t("validation.fixErrors"), errors);
  await db.store.update({ where: { id: store.id }, data: { theme: asJson(theme) } });
  await audit({ action: "theme.published", userId: user.id, storeId: store.id, meta: { sections: theme.sections.length } });
  revalidatePath("/", "layout");
  return ok(t("theme.published"));
}

/** Throws the draft away and goes back to what visitors see. */
export async function discardThemeDraftAction(slug: string): Promise<{ theme: Theme }> {
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const published = parseTheme(store.theme);
  if (themeDraft(store.theme)) await db.store.update({ where: { id: store.id }, data: { theme: asJson(published) } });
  return { theme: published };
}
