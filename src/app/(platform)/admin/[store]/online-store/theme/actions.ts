"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { fail, ok, type ActionState } from "@/lib/action";
import { getPlatformT } from "@/lib/i18n/server";
import { FONTS, themeSchema } from "@/lib/theme";

export async function saveThemeAction(slug: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(String(fd.get("payload") ?? "{}"));
  } catch {
    return fail(t("validation.fixErrors"));
  }
  // Strict checks first so merchants get errors instead of silent fallbacks.
  const fieldErrors: Record<string, string> = {};
  for (const k of ["primaryColor", "backgroundColor", "textColor"]) {
    if (typeof raw[k] !== "string" || !/^#[0-9a-fA-F]{6}$/.test(raw[k] as string)) fieldErrors[k] = t("theme.error.color");
  }
  if (!(String(raw.font) in FONTS)) fieldErrors.font = t("products.error.invalid");
  const imageFields = ["logoUrl", "faviconUrl", "heroImageUrl"];
  const localUrls = imageFields.map((k) => String(raw[k] ?? "")).filter((u) => u && !u.startsWith("https://"));
  if (localUrls.length) {
    const owned = await db.storedFile.count({ where: { storeId: store.id, url: { in: localUrls } } });
    if (owned !== new Set(localUrls).size) fieldErrors.logoUrl = t("products.error.image");
  }
  if (raw.featuredCollectionId) {
    const exists = await db.collection.findFirst({ where: { id: String(raw.featuredCollectionId), storeId: store.id } });
    if (!exists) fieldErrors.featuredCollectionId = t("products.error.invalid");
  }
  if (Object.keys(fieldErrors).length) return fail(t("validation.fixErrors"), fieldErrors);
  const theme = themeSchema.parse(raw);
  await db.store.update({ where: { id: store.id }, data: { theme } });
  revalidatePath("/", "layout");
  return ok(t("common.saved"));
}
