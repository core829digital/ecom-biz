import "server-only";
import { z } from "zod";
import { variantCombos, variantTitle, comboKey, MAX_VARIANTS } from "@/lib/variants";
import { ApiError } from "@/server/api";

const cents = z.number().int().min(0).max(100_000_000);

export const apiVariantInput = z.object({
  price: cents,
  compare_at_price: cents.nullable().optional(),
  sku: z.string().max(100).nullable().optional(),
  barcode: z.string().max(100).nullable().optional(),
  option1: z.string().max(60).nullable().optional(),
  option2: z.string().max(60).nullable().optional(),
  option3: z.string().max(60).nullable().optional(),
  track_inventory: z.boolean().optional(),
  inventory_quantity: z.number().int().min(-100000).max(10_000_000).optional(),
  allow_backorder: z.boolean().optional(),
  requires_shipping: z.boolean().optional(),
  taxable: z.boolean().optional(),
  weight_grams: z.number().int().min(0).max(1_000_000).optional(),
});

/** Base fields WITHOUT defaults: zod applies `.default()` even inside `.partial()`, which would
 *  silently reset omitted fields on PATCH. Defaults live only in the create schema. */
const productFields = {
  title: z.string().trim().min(1).max(255),
  handle: z.string().max(80),
  description: z.string().max(50_000),
  status: z.enum(["active", "draft", "archived"]),
  vendor: z.string().max(100).nullable(),
  product_type: z.string().max(100).nullable(),
  tags: z.array(z.string().trim().min(1).max(60)).max(100),
  seo_title: z.string().max(70).nullable(),
  seo_description: z.string().max(320).nullable(),
  images: z.array(z.object({ url: z.string().url().startsWith("https://").max(2000), alt: z.string().max(255).optional() })).max(50),
};

export const apiProductCreate = z.object({
  ...productFields,
  handle: productFields.handle.optional(),
  description: productFields.description.default(""),
  status: productFields.status.default("draft"),
  vendor: productFields.vendor.optional(),
  product_type: productFields.product_type.optional(),
  tags: productFields.tags.default([]),
  seo_title: productFields.seo_title.optional(),
  seo_description: productFields.seo_description.optional(),
  images: productFields.images.default([]),
  options: z.array(z.object({ name: z.string().trim().min(1).max(40), values: z.array(z.string().trim().min(1).max(60)).min(1).max(100) })).max(3).default([]),
  variants: z.array(apiVariantInput).min(1).max(MAX_VARIANTS),
});

export const apiProductUpdate = z
  .object(productFields)
  .partial()
  .extend({ variants: z.array(apiVariantInput.partial().extend({ id: z.string() })).max(MAX_VARIANTS).optional() });

/** Validate that variants cover each option combination exactly once; return DB-ready rows. */
export function variantRows(input: z.infer<typeof apiProductCreate>) {
  const combos = variantCombos(input.options);
  const expected = new Set(combos.map(comboKey));
  const seen = new Set<string>();
  return input.variants.map((v, position) => {
    const key = comboKey([v.option1, v.option2, v.option3]);
    if (combos.length === 0 ? key !== "" : !expected.has(key)) throw new ApiError(422, "invalid_variant", `Variant ${position + 1} does not match the product options.`);
    if (seen.has(key)) throw new ApiError(422, "duplicate_variant", `Duplicate variant "${key}".`);
    seen.add(key);
    return {
      option1: v.option1 ?? null,
      option2: v.option2 ?? null,
      option3: v.option3 ?? null,
      title: variantTitle([v.option1, v.option2, v.option3]),
      priceCents: v.price,
      compareAtCents: v.compare_at_price ?? null,
      sku: v.sku ?? null,
      barcode: v.barcode ?? null,
      trackInventory: v.track_inventory ?? true,
      inventoryQty: v.inventory_quantity ?? 0,
      allowBackorder: v.allow_backorder ?? false,
      requiresShipping: v.requires_shipping ?? true,
      taxable: v.taxable ?? true,
      weightGrams: v.weight_grams ?? 0,
      position,
    };
  });
}

export function validationError(e: z.ZodError) {
  const first = e.issues[0];
  return new ApiError(422, "validation_failed", `${first.path.join(".") || "body"}: ${first.message}`);
}
