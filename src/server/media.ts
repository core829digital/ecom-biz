import "server-only";
import type { Store } from "@prisma/client";
import { db } from "@/lib/db";
import { removeStoredObject, storeFile } from "@/lib/storage";
import { effectiveLimits, storeOwner } from "@/server/plans";

/**
 * Store file library: every upload (logos, product photos, banners, PDFs) is recorded here,
 * counted against the plan's space, and can be found, reused and deleted. Deleting a file that
 * is still shown somewhere is refused, so a merchant can't break their own storefront by accident.
 */
export class MediaError extends Error {
  constructor(public code: "quota" | "in_use" | "not_found", public detail?: { usedMb?: number; limitMb?: number; places?: string[] }) {
    super(code);
  }
}

export async function storageUsage(storeId: string) {
  const [agg, owner] = await Promise.all([
    db.storedFile.aggregate({ where: { storeId }, _sum: { size: true }, _count: true }),
    storeOwner(storeId),
  ]);
  const limitMb = effectiveLimits(owner).storageMb;
  const usedBytes = agg._sum.size ?? 0;
  return { usedBytes, files: agg._count, limitMb, limitBytes: limitMb === null ? null : limitMb * 1024 * 1024 };
}

/** Keeps only safe characters of the original name, for display. */
function cleanName(name: string) {
  return name.replace(/[^\p{L}\p{N} ._()-]/gu, "").trim().slice(0, 120) || "file";
}

export async function uploadMedia(store: Pick<Store, "id">, file: File, opts: { documents?: boolean } = {}) {
  const usage = await storageUsage(store.id);
  if (usage.limitBytes !== null && usage.usedBytes + file.size > usage.limitBytes) {
    throw new MediaError("quota", { usedMb: Math.round(usage.usedBytes / 1048576), limitMb: usage.limitMb ?? 0 });
  }
  const res = await storeFile(store.id, file, { documents: !!opts.documents });
  return db.storedFile.create({ data: { storeId: store.id, key: res.key, url: res.url, name: cleanName(file.name), contentType: res.contentType, size: res.size } });
}

/** Where each URL is used in the store (products, collections, blog, homepage design, SEO image). */
export async function fileReferences(store: Pick<Store, "id">, urls: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>(urls.map((u) => [u, []]));
  if (!urls.length) return out;
  const [images, collections, posts, fresh] = await Promise.all([
    db.productImage.findMany({ where: { url: { in: urls }, product: { storeId: store.id } }, select: { url: true, product: { select: { title: true } } } }),
    db.collection.findMany({ where: { storeId: store.id, imageUrl: { in: urls } }, select: { imageUrl: true, title: true } }),
    db.blogPost.findMany({ where: { storeId: store.id, coverUrl: { in: urls } }, select: { coverUrl: true, title: true } }),
    db.store.findUniqueOrThrow({ where: { id: store.id }, select: { theme: true, socialImageUrl: true } }),
  ]);
  const add = (url: string | null, place: string) => { if (url && out.has(url)) out.get(url)!.push(place); };
  images.forEach((i) => add(i.url, `product:${i.product.title}`));
  collections.forEach((c) => add(c.imageUrl, `collection:${c.title}`));
  posts.forEach((p) => add(p.coverUrl, `blog:${p.title}`));
  add(fresh.socialImageUrl, "seo");
  const themeJson = JSON.stringify(fresh.theme ?? {});
  for (const u of urls) if (themeJson.includes(JSON.stringify(u))) out.get(u)!.push("theme");
  return out;
}

export async function deleteMedia(store: Pick<Store, "id">, fileId: string) {
  const file = await db.storedFile.findFirst({ where: { id: fileId, storeId: store.id } });
  if (!file) throw new MediaError("not_found");
  const places = (await fileReferences(store, [file.url])).get(file.url) ?? [];
  if (places.length) throw new MediaError("in_use", { places });
  await removeStoredObject(file.key);
  await db.storedFile.delete({ where: { id: file.id } });
  return file;
}
