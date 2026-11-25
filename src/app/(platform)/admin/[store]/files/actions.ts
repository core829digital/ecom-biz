"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { MAX_UPLOAD_MB, UploadError } from "@/lib/storage";
import { deleteMedia, MediaError, uploadMedia } from "@/server/media";
import { audit } from "@/server/audit";

export type MediaItem = { id: string; url: string; name: string; contentType: string; size: number; createdAt: string };

/** One file per call (the browser uploads several in sequence and shows each result). */
export async function uploadFileAction(slug: string, fd: FormData): Promise<{ file?: MediaItem; error?: string }> {
  const { store } = await requireStoreAccess(slug);
  const { t } = await getPlatformT();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: t("upload.failed") };
  try {
    const f = await uploadMedia(store, file, { documents: true });
    revalidatePath(`/admin/${slug}/files`);
    return { file: { id: f.id, url: f.url, name: f.name, contentType: f.contentType, size: f.size, createdAt: f.createdAt.toISOString() } };
  } catch (e) {
    if (e instanceof MediaError && e.code === "quota") return { error: t("media.error.quota", { used: e.detail?.usedMb ?? 0, limit: e.detail?.limitMb ?? 0 }) };
    if (e instanceof UploadError) return { error: e.code === "too_large" ? t("upload.tooLarge", { max: MAX_UPLOAD_MB }) : t("media.error.type") };
    console.error("[media] upload", e);
    return { error: t("upload.failed") };
  }
}

export async function deleteFileAction(slug: string, id: string): Promise<{ ok?: boolean; error?: string }> {
  const { store, user } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  try {
    const f = await deleteMedia(store, id);
    await audit({ userId: user.id, storeId: store.id, action: "media.delete", target: f.name });
    revalidatePath(`/admin/${slug}/files`);
    return { ok: true };
  } catch (e) {
    if (e instanceof MediaError && e.code === "in_use") return { error: t("media.error.inUse", { places: (e.detail?.places ?? []).length }) };
    if (e instanceof MediaError) return { error: t("media.error.notFound") };
    throw e;
  }
}

/** Images for the "choose from library" picker (newest first, paged). */
export async function listImagesAction(slug: string, page = 1): Promise<{ items: MediaItem[]; more: boolean }> {
  const { store } = await requireStoreAccess(slug);
  const take = 48;
  const rows = await db.storedFile.findMany({ where: { storeId: store.id, contentType: { startsWith: "image/" } }, orderBy: { createdAt: "desc" }, skip: (Math.max(1, page) - 1) * take, take: take + 1 });
  return { items: rows.slice(0, take).map((f) => ({ id: f.id, url: f.url, name: f.name, contentType: f.contentType, size: f.size, createdAt: f.createdAt.toISOString() })), more: rows.length > take };
}
