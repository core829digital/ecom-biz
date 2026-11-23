"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { fail, ok, type ActionState } from "@/lib/action";
import { getPlatformT } from "@/lib/i18n/server";
import { COLLECTION_SORTS, RULE_FIELDS, RULE_OPS } from "@/lib/collections";
import { handleize } from "@/lib/slug";
import { uniqueHandle } from "@/server/catalog";

const ruleSchema = z
  .object({ field: z.enum(RULE_FIELDS as [string, ...string[]]), op: z.string(), value: z.string().trim().min(1).max(100) })
  .refine((r) => RULE_OPS[r.field as keyof typeof RULE_OPS].includes(r.op as never));

const schema = z.object({
  title: z.string().trim().min(1).max(255),
  handle: z.string().trim().max(80).default(""),
  description: z.string().max(20_000).default(""),
  imageUrl: z.string().max(2000).default(""),
  type: z.enum(["MANUAL", "SMART"]),
  rules: z.array(ruleSchema).max(20).default([]),
  matchAll: z.boolean().default(true),
  sortOrder: z.enum(COLLECTION_SORTS),
  published: z.boolean().default(true),
  seoTitle: z.string().trim().max(70).default(""),
  seoDescription: z.string().trim().max(320).default(""),
});

export async function saveCollectionAction(slug: string, id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store } = await requireStoreAccess(slug);
  const { t } = await getPlatformT();
  let raw: unknown;
  try {
    raw = JSON.parse(String(fd.get("payload") ?? ""));
  } catch {
    return fail(t("validation.fixErrors"));
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[i.path.join(".")] ??= i.path[0] === "title" ? t("validation.required") : t("products.error.invalid");
    return fail(t("validation.fixErrors"), fieldErrors);
  }
  const c = parsed.data;
  if (c.type === "SMART" && c.rules.length === 0) return fail(t("validation.fixErrors"), { rules: t("collections.error.rules") });
  if (c.imageUrl && !c.imageUrl.startsWith("https://")) {
    const owned = await db.storedFile.findFirst({ where: { storeId: store.id, url: c.imageUrl } });
    if (!owned) return fail(t("products.error.image"));
  }
  const existing = id ? await db.collection.findFirst({ where: { id, storeId: store.id } }) : null;
  if (id && !existing) return fail(t("common.notFound"));
  const handle = await uniqueHandle(store.id, c.handle ? handleize(c.handle) : c.title, "collection", id ?? undefined);
  const data = {
    title: c.title,
    handle,
    description: c.description,
    imageUrl: c.imageUrl || null,
    type: c.type,
    rules: c.type === "SMART" ? c.rules : [],
    matchAll: c.matchAll,
    sortOrder: c.type === "SMART" && c.sortOrder === "manual" ? "newest" : c.sortOrder,
    published: c.published,
    seoTitle: c.seoTitle || null,
    seoDescription: c.seoDescription || null,
  };
  const saved = existing
    ? await db.collection.update({ where: { id: existing.id }, data })
    : await db.collection.create({ data: { ...data, storeId: store.id } });
  if (existing && existing.type === "MANUAL" && c.type === "SMART") {
    await db.collectionProduct.deleteMany({ where: { collectionId: saved.id } });
  }
  revalidatePath(`/admin/${slug}/collections`);
  if (!existing) redirect(`/admin/${slug}/collections/${saved.id}`);
  return ok(t("common.saved"));
}

export async function deleteCollectionAction(slug: string, id: string) {
  const { store } = await requireStoreAccess(slug, "ADMIN");
  await db.collection.deleteMany({ where: { id, storeId: store.id } });
  revalidatePath(`/admin/${slug}/collections`);
  redirect(`/admin/${slug}/collections`);
}

async function ownedManualCollection(storeId: string, id: string) {
  return db.collection.findFirst({ where: { id, storeId, type: "MANUAL" } });
}

export async function addProductToCollectionAction(slug: string, collectionId: string, productId: string) {
  const { store } = await requireStoreAccess(slug);
  const collection = await ownedManualCollection(store.id, collectionId);
  const product = await db.product.findFirst({ where: { id: productId, storeId: store.id } });
  if (collection && product) {
    const max = await db.collectionProduct.aggregate({ where: { collectionId }, _max: { position: true } });
    await db.collectionProduct.upsert({
      where: { collectionId_productId: { collectionId, productId } },
      create: { collectionId, productId, position: (max._max.position ?? 0) + 1 },
      update: {},
    });
  }
  revalidatePath(`/admin/${slug}/collections/${collectionId}`);
}

export async function removeProductFromCollectionAction(slug: string, collectionId: string, productId: string) {
  const { store } = await requireStoreAccess(slug);
  if (await ownedManualCollection(store.id, collectionId)) {
    await db.collectionProduct.deleteMany({ where: { collectionId, productId } });
  }
  revalidatePath(`/admin/${slug}/collections/${collectionId}`);
}

export async function moveProductInCollectionAction(slug: string, collectionId: string, productId: string, dir: -1 | 1) {
  const { store } = await requireStoreAccess(slug);
  if (!(await ownedManualCollection(store.id, collectionId))) return;
  const links = await db.collectionProduct.findMany({ where: { collectionId }, orderBy: [{ position: "asc" }, { productId: "asc" }] });
  const i = links.findIndex((l) => l.productId === productId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= links.length) return;
  [links[i], links[j]] = [links[j], links[i]];
  await db.$transaction(
    links.map((l, position) => db.collectionProduct.update({ where: { collectionId_productId: { collectionId, productId: l.productId } }, data: { position } })),
  );
  revalidatePath(`/admin/${slug}/collections/${collectionId}`);
}
