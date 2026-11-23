import { db } from "@/lib/db";
import { ApiError, apiRoute, productApiInclude, productPayload } from "@/server/api";
import { apiProductUpdate, validationError } from "@/server/api-products";
import { uniqueHandle } from "@/server/catalog";
import { handleize } from "@/lib/slug";
import { emitWebhook } from "@/server/webhooks";
import { notifyBackInStock } from "@/server/stock-alerts";

type P = { id: string };

async function find(storeId: string, id: string) {
  const product = await db.product.findFirst({ where: { id, storeId }, include: productApiInclude });
  if (!product) throw new ApiError(404, "not_found", "Product not found.");
  return product;
}

export const GET = apiRoute<P>("read_products", async ({ store }, _req, { id }) => Response.json({ data: productPayload(await find(store.id, id)) }));

export const PATCH = apiRoute<P>("write_products", async ({ store }, req, { id }) => {
  const existing = await find(store.id, id);
  const parsed = apiProductUpdate.safeParse(await req.json());
  if (!parsed.success) throw validationError(parsed.error);
  const p = parsed.data;
  const ownIds = new Set(existing.variants.map((v) => v.id));
  for (const v of p.variants ?? []) if (!ownIds.has(v.id)) throw new ApiError(422, "invalid_variant", `Variant ${v.id} does not belong to this product.`);
  const status = p.status ? (p.status.toUpperCase() as "ACTIVE" | "DRAFT" | "ARCHIVED") : undefined;
  await db.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: existing.id },
      data: {
        ...(p.title !== undefined ? { title: p.title } : {}),
        ...(p.handle !== undefined ? { handle: await uniqueHandle(store.id, handleize(p.handle) || existing.title, "product", existing.id) } : {}),
        ...(p.description !== undefined ? { description: p.description } : {}),
        ...(status ? { status, publishedAt: status === "ACTIVE" ? existing.publishedAt ?? new Date() : existing.publishedAt } : {}),
        ...(p.vendor !== undefined ? { vendor: p.vendor } : {}),
        ...(p.product_type !== undefined ? { productType: p.product_type } : {}),
        ...(p.tags !== undefined ? { tags: p.tags } : {}),
        ...(p.seo_title !== undefined ? { seoTitle: p.seo_title } : {}),
        ...(p.seo_description !== undefined ? { seoDescription: p.seo_description } : {}),
      },
    });
    if (p.images) {
      await tx.productImage.deleteMany({ where: { productId: existing.id } });
      await tx.productImage.createMany({ data: p.images.map((img, position) => ({ productId: existing.id, url: img.url, alt: img.alt ?? null, position })) });
    }
    for (const v of p.variants ?? []) {
      await tx.productVariant.update({
        where: { id: v.id },
        data: {
          ...(v.price !== undefined ? { priceCents: v.price } : {}),
          ...(v.compare_at_price !== undefined ? { compareAtCents: v.compare_at_price } : {}),
          ...(v.sku !== undefined ? { sku: v.sku } : {}),
          ...(v.barcode !== undefined ? { barcode: v.barcode } : {}),
          ...(v.track_inventory !== undefined ? { trackInventory: v.track_inventory } : {}),
          ...(v.inventory_quantity !== undefined ? { inventoryQty: v.inventory_quantity } : {}),
          ...(v.allow_backorder !== undefined ? { allowBackorder: v.allow_backorder } : {}),
          ...(v.requires_shipping !== undefined ? { requiresShipping: v.requires_shipping } : {}),
          ...(v.taxable !== undefined ? { taxable: v.taxable } : {}),
          ...(v.weight_grams !== undefined ? { weightGrams: v.weight_grams } : {}),
        },
      });
    }
  });
  const updated = await find(store.id, id);
  await emitWebhook(store.id, "products/update", { id: updated.id, title: updated.title, handle: updated.handle, status: updated.status });
  await notifyBackInStock(updated.variants.map((v) => v.id));
  return Response.json({ data: productPayload(updated) });
});

export const DELETE = apiRoute<P>("write_products", async ({ store }, _req, { id }) => {
  const existing = await find(store.id, id);
  await db.product.delete({ where: { id: existing.id } });
  await emitWebhook(store.id, "products/delete", { id: existing.id });
  return new Response(null, { status: 204 });
});
