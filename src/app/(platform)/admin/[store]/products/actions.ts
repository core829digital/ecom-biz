"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { fail, ok, type ActionState } from "@/lib/action";
import { getPlatformT } from "@/lib/i18n/server";
import { parseMoney } from "@/lib/money";
import { comboKey, MAX_VARIANTS, variantCombos, variantTitle } from "@/lib/variants";
import { MAX_UPLOAD_MB, UploadError } from "@/lib/storage";
import { uniqueHandle } from "@/server/catalog";
import { handleize } from "@/lib/slug";
import { emitWebhook } from "@/server/webhooks";
import { MediaError, uploadMedia } from "@/server/media";
import { assertCanAddProducts, PlanLimitError } from "@/server/plans";
import { audit } from "@/server/audit";
import { notifyBackInStock } from "@/server/stock-alerts";

const variantSchema = z.object({
  id: z.string().optional(),
  option1: z.string().nullable().optional(),
  option2: z.string().nullable().optional(),
  option3: z.string().nullable().optional(),
  price: z.string(),
  compareAt: z.string().optional().default(""),
  cost: z.string().optional().default(""),
  sku: z.string().trim().max(100).optional().default(""),
  barcode: z.string().trim().max(100).optional().default(""),
  trackInventory: z.boolean(),
  inventoryQty: z.coerce.number().int().min(-100000).max(10_000_000),
  allowBackorder: z.boolean(),
  requiresShipping: z.boolean(),
  taxable: z.boolean(),
  weightGrams: z.coerce.number().int().min(0).max(1_000_000),
});

const productSchema = z.object({
  title: z.string().trim().min(1).max(255),
  handle: z.string().trim().max(80).optional().default(""),
  description: z.string().max(50_000).default(""),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
  vendor: z.string().trim().max(100).default(""),
  productType: z.string().trim().max(100).default(""),
  tags: z.array(z.string().trim().min(1).max(60)).max(100).default([]),
  seoTitle: z.string().trim().max(70).default(""),
  seoDescription: z.string().trim().max(320).default(""),
  images: z.array(z.object({ url: z.string().max(2000), alt: z.string().max(255).default("") })).max(50).default([]),
  options: z.array(z.object({ name: z.string().trim().min(1).max(40), values: z.array(z.string().trim().min(1).max(60)).min(1).max(100) })).max(3).default([]),
  variants: z.array(variantSchema).min(1).max(MAX_VARIANTS),
  collectionIds: z.array(z.string()).max(200).default([]),
});

export type ProductPayload = z.input<typeof productSchema>;

export async function saveProductAction(slug: string, productId: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store } = await requireStoreAccess(slug);
  const { t } = await getPlatformT();
  let raw: unknown;
  try {
    raw = JSON.parse(String(fd.get("payload") ?? ""));
  } catch {
    return fail(t("validation.fixErrors"));
  }
  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[i.path.join(".")] ??= i.path[0] === "title" ? t("validation.required") : t("products.error.invalid");
    return fail(t("validation.fixErrors"), fieldErrors);
  }
  const p = parsed.data;

  // Option names and values must be unique; variants must map 1:1 onto option combinations.
  const fieldErrors: Record<string, string> = {};
  const optNames = p.options.map((o) => o.name.toLowerCase());
  if (new Set(optNames).size !== optNames.length) fieldErrors["options"] = t("products.error.duplicateOption");
  p.options.forEach((o, i) => {
    if (new Set(o.values.map((v) => v.toLowerCase())).size !== o.values.length) fieldErrors[`options.${i}`] = t("products.error.duplicateValue");
  });
  const combos = variantCombos(p.options);
  if (combos.length > MAX_VARIANTS) fieldErrors["options"] = t("products.error.tooManyVariants", { max: MAX_VARIANTS });
  const expected = new Set(combos.map(comboKey));
  const seen = new Set<string>();
  const variants = p.variants.map((v, i) => {
    const key = comboKey([v.option1, v.option2, v.option3]);
    if (combos.length === 0 ? key !== "" : !expected.has(key)) fieldErrors[`variants.${i}`] = t("products.error.invalid");
    if (seen.has(key)) fieldErrors[`variants.${i}`] = t("products.error.invalid");
    seen.add(key);
    const priceCents = parseMoney(v.price);
    if (priceCents === null) fieldErrors[`variants.${i}.price`] = t("products.error.price");
    const compareAtCents = v.compareAt ? parseMoney(v.compareAt) : null;
    if (v.compareAt && compareAtCents === null) fieldErrors[`variants.${i}.compareAt`] = t("products.error.price");
    const costCents = v.cost ? parseMoney(v.cost) : null;
    if (v.cost && costCents === null) fieldErrors[`variants.${i}.cost`] = t("products.error.price");
    return {
      id: v.id,
      option1: v.option1 || null,
      option2: v.option2 || null,
      option3: v.option3 || null,
      title: variantTitle([v.option1, v.option2, v.option3]),
      priceCents: priceCents ?? 0,
      compareAtCents,
      costCents,
      sku: v.sku || null,
      barcode: v.barcode || null,
      trackInventory: v.trackInventory,
      inventoryQty: v.inventoryQty,
      allowBackorder: v.allowBackorder,
      requiresShipping: v.requiresShipping,
      taxable: v.taxable,
      weightGrams: v.weightGrams,
      position: i,
    };
  });
  if (combos.length > 0 && seen.size !== expected.size) fieldErrors["options"] = t("products.error.variantsMismatch");
  if (Object.keys(fieldErrors).length) return fail(t("validation.fixErrors"), fieldErrors);

  // Images: allow only https URLs or files uploaded to THIS store.
  const localUrls = p.images.filter((i) => !i.url.startsWith("https://")).map((i) => i.url);
  if (localUrls.length) {
    const owned = await db.storedFile.count({ where: { storeId: store.id, url: { in: localUrls } } });
    if (owned !== new Set(localUrls).size) return fail(t("products.error.image"));
  }

  // Collections must belong to the store and be manual.
  const collections = await db.collection.findMany({
    where: { storeId: store.id, id: { in: p.collectionIds }, type: "MANUAL" },
    select: { id: true },
  });

  const existing = productId ? await db.product.findFirst({ where: { id: productId, storeId: store.id }, include: { variants: { select: { id: true } } } }) : null;
  if (productId && !existing) return fail(t("common.notFound"));
  if (!existing) {
    try {
      await assertCanAddProducts(store.id);
    } catch (e) {
      if (e instanceof PlanLimitError) return fail(t("usage.limitProductsDetail", { count: e.limit ?? 0 }));
      throw e;
    }
  }

  const handle = await uniqueHandle(store.id, p.handle ? handleize(p.handle) : p.title, "product", productId ?? undefined);
  const data = {
    title: p.title,
    handle,
    description: p.description,
    status: p.status,
    vendor: p.vendor || null,
    productType: p.productType || null,
    tags: [...new Set(p.tags)],
    seoTitle: p.seoTitle || null,
    seoDescription: p.seoDescription || null,
    publishedAt: p.status === "ACTIVE" ? (existing?.publishedAt ?? new Date()) : existing?.publishedAt ?? null,
  };

  const ownVariantIds = new Set(existing?.variants.map((v) => v.id) ?? []);
  const id = await db.$transaction(async (tx) => {
    const product = existing
      ? await tx.product.update({ where: { id: existing.id }, data })
      : await tx.product.create({ data: { ...data, storeId: store.id } });

    await tx.productOption.deleteMany({ where: { productId: product.id } });
    if (p.options.length) {
      await tx.productOption.createMany({
        data: p.options.map((o, i) => ({ productId: product.id, name: o.name, values: o.values, position: i + 1 })),
      });
    }

    await tx.productImage.deleteMany({ where: { productId: product.id } });
    if (p.images.length) {
      await tx.productImage.createMany({
        data: p.images.map((img, i) => ({ productId: product.id, url: img.url, alt: img.alt || null, position: i })),
      });
    }

    const keepIds = variants.filter((v) => v.id && ownVariantIds.has(v.id)).map((v) => v.id!);
    await tx.productVariant.deleteMany({ where: { productId: product.id, id: { notIn: keepIds } } });
    for (const v of variants) {
      const { id: vid, ...vdata } = v;
      if (vid && ownVariantIds.has(vid)) await tx.productVariant.update({ where: { id: vid }, data: vdata });
      else await tx.productVariant.create({ data: { ...vdata, productId: product.id } });
    }

    await tx.collectionProduct.deleteMany({
      where: { productId: product.id, collectionId: { notIn: collections.map((c) => c.id) } },
    });
    for (const c of collections) {
      const max = await tx.collectionProduct.aggregate({ where: { collectionId: c.id }, _max: { position: true } });
      await tx.collectionProduct.upsert({
        where: { collectionId_productId: { collectionId: c.id, productId: product.id } },
        create: { collectionId: c.id, productId: product.id, position: (max._max.position ?? 0) + 1 },
        update: {},
      });
    }
    return product.id;
  });

  await emitWebhook(store.id, existing ? "products/update" : "products/create", { id, title: p.title, handle, status: p.status });
  if (existing) await notifyBackInStock(existing.variants.map((v) => v.id));
  revalidatePath(`/admin/${slug}/products`);
  if (!existing) redirect(`/admin/${slug}/products/${id}?created=1`);
  return ok(t("common.saved"));
}

export async function uploadImageAction(slug: string, fd: FormData): Promise<{ url?: string; error?: string }> {
  const { store } = await requireStoreAccess(slug);
  const { t } = await getPlatformT();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: t("products.error.image") };
  try {
    const res = await uploadMedia(store, file);
    return { url: res.url };
  } catch (e) {
    if (e instanceof MediaError && e.code === "quota") return { error: t("media.error.quota", { used: e.detail?.usedMb ?? 0, limit: e.detail?.limitMb ?? 0 }) };
    if (e instanceof UploadError) return { error: e.code === "too_large" ? t("upload.tooLarge", { max: MAX_UPLOAD_MB }) : t("upload.unsupported") };
    console.error("[upload]", e);
    return { error: t("upload.failed") };
  }
}

export async function deleteProductAction(slug: string, productId: string) {
  const { store, user } = await requireStoreAccess(slug, "ADMIN");
  const product = await db.product.findFirst({ where: { id: productId, storeId: store.id } });
  if (product) {
    await db.product.delete({ where: { id: product.id } });
    await audit({ userId: user.id, storeId: store.id, action: "product.delete", target: product.title });
    await emitWebhook(store.id, "products/delete", { id: product.id });
  }
  revalidatePath(`/admin/${slug}/products`);
  redirect(`/admin/${slug}/products`);
}

export async function duplicateProductAction(slug: string, productId: string) {
  const { store } = await requireStoreAccess(slug);
  const src = await db.product.findFirst({
    where: { id: productId, storeId: store.id },
    include: { options: true, images: true, variants: true, collections: true },
  });
  if (!src) redirect(`/admin/${slug}/products`);
  try {
    await assertCanAddProducts(store.id);
  } catch (e) {
    if (e instanceof PlanLimitError) redirect(`/admin/${slug}/products/${productId}?limit=products`);
    throw e;
  }
  const title = `${src.title} (copy)`;
  const handle = await uniqueHandle(store.id, title, "product");
  const copy = await db.product.create({
    data: {
      storeId: store.id,
      title,
      handle,
      description: src.description,
      status: "DRAFT",
      vendor: src.vendor,
      productType: src.productType,
      tags: src.tags,
      seoTitle: src.seoTitle,
      seoDescription: src.seoDescription,
      options: { create: src.options.map(({ name, position, values }) => ({ name, position, values })) },
      images: { create: src.images.map(({ url, alt, position }) => ({ url, alt, position })) },
      variants: {
        create: src.variants.map(({ id: _id, productId: _p, createdAt: _c, updatedAt: _u, imageId: _i, ...v }) => ({ ...v, sku: null, inventoryQty: 0 })),
      },
      collections: { create: src.collections.map(({ collectionId, position }) => ({ collectionId, position })) },
    },
  });
  redirect(`/admin/${slug}/products/${copy.id}`);
}

export async function bulkProductsAction(slug: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const op = String(fd.get("op") ?? "");
  const minRole = op === "delete" ? "ADMIN" : "STAFF";
  const { store, user } = await requireStoreAccess(slug, minRole);
  const { t } = await getPlatformT();
  const ids = fd.getAll("ids").map(String).slice(0, 500);
  if (!ids.length) return fail(t("products.bulk.none"));
  const where: Prisma.ProductWhereInput = { storeId: store.id, id: { in: ids } };
  if (op === "delete") {
    await db.product.deleteMany({ where });
    await audit({ userId: user.id, storeId: store.id, action: "product.bulk_delete", meta: { count: ids.length } });
  }
  else if (op === "ACTIVE" || op === "DRAFT" || op === "ARCHIVED") {
    await db.product.updateMany({ where, data: { status: op, ...(op === "ACTIVE" ? { publishedAt: new Date() } : {}) } });
  } else return fail(t("products.error.invalid"));
  revalidatePath(`/admin/${slug}/products`);
  return ok(t("products.bulk.done", { count: ids.length }));
}

export async function updateInventoryAction(slug: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store } = await requireStoreAccess(slug);
  const { t } = await getPlatformT();
  const updates: { id: string; qty: number }[] = [];
  for (const [k, v] of fd.entries()) {
    if (!k.startsWith("qty:")) continue;
    const qty = Number(v);
    if (!Number.isInteger(qty) || Math.abs(qty) > 10_000_000) return fail(t("products.error.invalid"));
    updates.push({ id: k.slice(4), qty });
  }
  const owned = await db.productVariant.findMany({
    where: { id: { in: updates.map((u) => u.id) }, product: { storeId: store.id } },
    select: { id: true, inventoryQty: true },
  });
  const ownedMap = new Map(owned.map((o) => [o.id, o.inventoryQty]));
  const changed = updates.filter((u) => ownedMap.has(u.id) && ownedMap.get(u.id) !== u.qty);
  await db.$transaction(changed.map((u) => db.productVariant.update({ where: { id: u.id }, data: { inventoryQty: u.qty } })));
  for (const u of changed) await emitWebhook(store.id, "inventory/update", { variantId: u.id, available: u.qty });
  await notifyBackInStock(changed.filter((u) => u.qty > 0).map((u) => u.id));
  revalidatePath(`/admin/${slug}/products/inventory`);
  return ok(t("inventory.updated", { count: changed.length }));
}

export async function importProductsAction(slug: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return fail(t("import.noFile"));
  if (file.size > Math.min(5, MAX_UPLOAD_MB) * 1024 * 1024) return fail(t("upload.tooLarge", { max: Math.min(5, MAX_UPLOAD_MB) }));
  const { importProductsCsv } = await import("@/server/product-csv");
  const res = await importProductsCsv(store.id, await file.text());
  if (res.limitReached) res.errors.unshift({ line: 0, message: t("usage.limitProductsDetail", { count: res.limitReached }) });
  revalidatePath(`/admin/${slug}/products`);
  const summary = t("import.summary", { created: res.created, updated: res.updated, errors: res.errors.length });
  if (res.errors.length) {
    const details = res.errors.slice(0, 20).map((e) => `${t("import.line")} ${e.line}: ${e.message}`).join(" · ");
    return { ok: res.created + res.updated > 0, error: `${summary} — ${details}`, at: Date.now() };
  }
  return ok(summary);
}
