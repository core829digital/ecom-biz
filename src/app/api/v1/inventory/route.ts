import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, apiRoute } from "@/server/api";
import { validationError } from "@/server/api-products";
import { emitWebhook } from "@/server/webhooks";

const body = z
  .object({
    variant_id: z.string().optional(),
    sku: z.string().optional(),
    available: z.number().int().min(-100000).max(10_000_000).optional(),
    adjustment: z.number().int().min(-10_000_000).max(10_000_000).optional(),
  })
  .refine((b) => !!b.variant_id !== !!b.sku, "Provide exactly one of variant_id or sku")
  .refine((b) => (b.available === undefined) !== (b.adjustment === undefined), "Provide exactly one of available or adjustment");

/** Set (`available`) or atomically adjust (`adjustment`) stock for a variant, by id or SKU. */
export const POST = apiRoute("write_inventory", async ({ store }, req) => {
  const parsed = body.safeParse(await req.json());
  if (!parsed.success) throw validationError(parsed.error);
  const b = parsed.data;
  const matches = await db.productVariant.findMany({
    where: { product: { storeId: store.id }, ...(b.variant_id ? { id: b.variant_id } : { sku: b.sku }) },
    select: { id: true },
    take: 2,
  });
  if (matches.length === 0) throw new ApiError(404, "not_found", "Variant not found.");
  if (matches.length > 1) throw new ApiError(409, "ambiguous_sku", "More than one variant has this SKU; use variant_id.");
  const variant = await db.productVariant.update({
    where: { id: matches[0].id },
    data: b.available !== undefined ? { inventoryQty: b.available } : { inventoryQty: { increment: b.adjustment! } },
    select: { id: true, sku: true, inventoryQty: true },
  });
  await emitWebhook(store.id, "inventory/update", { variantId: variant.id, available: variant.inventoryQty });
  return Response.json({ data: { variant_id: variant.id, sku: variant.sku, available: variant.inventoryQty } });
});

export const GET = apiRoute("read_inventory", async ({ store }, req) => {
  const url = new URL(req.url);
  const sku = url.searchParams.get("sku");
  const variants = await db.productVariant.findMany({
    where: { product: { storeId: store.id }, trackInventory: true, ...(sku ? { sku } : {}) },
    select: { id: true, sku: true, inventoryQty: true, productId: true },
    take: 1000,
    orderBy: { id: "asc" },
  });
  return Response.json({ data: variants.map((v) => ({ variant_id: v.id, product_id: v.productId, sku: v.sku, available: v.inventoryQty })) });
});
