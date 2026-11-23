import "server-only";
import { db } from "@/lib/db";
import { parseCsv } from "@/lib/csv";
import { parseMoney } from "@/lib/money";
import { handleize } from "@/lib/slug";
import { variantTitle, MAX_VARIANTS } from "@/lib/variants";

/** Column layout compatible with the common Shopify product CSV for the core fields. */
export const PRODUCT_CSV_HEADERS = [
  "Handle", "Title", "Description", "Vendor", "Type", "Tags", "Status",
  "Option1 Name", "Option1 Value", "Option2 Name", "Option2 Value", "Option3 Name", "Option3 Value",
  "Variant SKU", "Variant Barcode", "Variant Price", "Variant Compare At Price", "Variant Cost",
  "Variant Inventory Qty", "Variant Track Inventory", "Variant Allow Backorder", "Variant Requires Shipping",
  "Variant Taxable", "Variant Grams", "Image Src", "Image Alt", "SEO Title", "SEO Description",
];

export const MAX_IMPORT_ROWS = 5000;

const bool = (v: string | undefined, dflt: boolean) => (v === undefined || v.trim() === "" ? dflt : /^(true|1|yes|y)$/i.test(v.trim()));

export type ImportResult = { created: number; updated: number; errors: { line: number; message: string }[] };

/**
 * Import (create or update by handle). Each product's rows are applied atomically;
 * a bad product is reported and skipped without affecting the others.
 */
export async function importProductsCsv(storeId: string, text: string): Promise<ImportResult> {
  const rows = parseCsv(text);
  const result: ImportResult = { created: 0, updated: 0, errors: [] };
  if (rows.length < 2) {
    result.errors.push({ line: 1, message: "The file has no data rows." });
    return result;
  }
  if (rows.length - 1 > MAX_IMPORT_ROWS) {
    result.errors.push({ line: 1, message: `Too many rows (max ${MAX_IMPORT_ROWS}).` });
    return result;
  }
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name.toLowerCase());
  if (col("Handle") < 0 && col("Title") < 0) {
    result.errors.push({ line: 1, message: "Missing required column: Handle or Title." });
    return result;
  }
  const get = (row: string[], name: string) => {
    const i = col(name);
    return i >= 0 ? (row[i] ?? "").trim() : "";
  };

  // Group rows by handle, preserving order.
  const groups = new Map<string, { line: number; row: string[] }[]>();
  rows.slice(1).forEach((row, idx) => {
    const handle = handleize(get(row, "Handle") || get(row, "Title"));
    if (!handle) {
      result.errors.push({ line: idx + 2, message: "Row has no handle or title." });
      return;
    }
    if (!groups.has(handle)) groups.set(handle, []);
    groups.get(handle)!.push({ line: idx + 2, row });
  });

  for (const [handle, items] of groups) {
    const first = items[0].row;
    const line = items[0].line;
    try {
      const title = get(first, "Title");
      const optionNames = [1, 2, 3].map((n) => get(first, `Option${n} Name`)).filter((n) => n && n.toLowerCase() !== "title");
      const variantRows = items.filter((i) => get(i.row, "Variant Price") !== "" || get(i.row, "Variant SKU") !== "" || get(i.row, "Option1 Value") !== "");
      if (variantRows.length === 0) throw new Error("Product needs at least one variant row with a price.");
      if (variantRows.length > MAX_VARIANTS) throw new Error(`Too many variants (max ${MAX_VARIANTS}).`);
      const seen = new Set<string>();
      const variants = variantRows.map(({ row, line: l }, position) => {
        const values = optionNames.map((_, i) => get(row, `Option${i + 1} Value`) || null);
        if (optionNames.length && values.some((v) => !v)) throw new Error(`Line ${l}: missing option value.`);
        const key = values.join(" / ");
        if (seen.has(key)) throw new Error(`Line ${l}: duplicate variant "${key}".`);
        seen.add(key);
        const price = parseMoney(get(row, "Variant Price") || "0");
        if (price === null) throw new Error(`Line ${l}: invalid price.`);
        const compareRaw = get(row, "Variant Compare At Price");
        const costRaw = get(row, "Variant Cost");
        const qty = parseInt(get(row, "Variant Inventory Qty") || "0", 10);
        return {
          option1: values[0] ?? null,
          option2: values[1] ?? null,
          option3: values[2] ?? null,
          title: variantTitle(values),
          priceCents: price,
          compareAtCents: compareRaw ? parseMoney(compareRaw) : null,
          costCents: costRaw ? parseMoney(costRaw) : null,
          sku: get(row, "Variant SKU") || null,
          barcode: get(row, "Variant Barcode") || null,
          inventoryQty: Number.isFinite(qty) ? qty : 0,
          trackInventory: bool(get(row, "Variant Track Inventory"), true),
          allowBackorder: bool(get(row, "Variant Allow Backorder"), false),
          requiresShipping: bool(get(row, "Variant Requires Shipping"), true),
          taxable: bool(get(row, "Variant Taxable"), true),
          weightGrams: Math.max(0, parseInt(get(row, "Variant Grams") || "0", 10) || 0),
          position,
        };
      });
      const options = optionNames.map((name, i) => ({
        name,
        position: i + 1,
        values: [...new Set(variants.map((v) => [v.option1, v.option2, v.option3][i]).filter((x): x is string => !!x))],
      }));
      const images = items
        .map(({ row }) => ({ url: get(row, "Image Src"), alt: get(row, "Image Alt") }))
        .filter((i) => /^https:\/\//.test(i.url))
        .map((i, position) => ({ url: i.url, alt: i.alt || null, position }));
      const statusRaw = get(first, "Status").toUpperCase();
      const status = statusRaw === "ACTIVE" || statusRaw === "ARCHIVED" ? statusRaw : "DRAFT";

      const existing = await db.product.findUnique({ where: { storeId_handle: { storeId, handle } } });
      const data = {
        title: title || existing?.title || handle,
        description: get(first, "Description") || existing?.description || "",
        vendor: get(first, "Vendor") || null,
        productType: get(first, "Type") || null,
        tags: get(first, "Tags").split(",").map((s) => s.trim()).filter(Boolean),
        status: status as "ACTIVE" | "DRAFT" | "ARCHIVED",
        seoTitle: get(first, "SEO Title") || null,
        seoDescription: get(first, "SEO Description") || null,
        publishedAt: status === "ACTIVE" ? existing?.publishedAt ?? new Date() : existing?.publishedAt ?? null,
      };
      await db.$transaction(async (tx) => {
        const product = existing
          ? await tx.product.update({ where: { id: existing.id }, data })
          : await tx.product.create({ data: { ...data, storeId, handle } });
        await tx.productOption.deleteMany({ where: { productId: product.id } });
        await tx.productVariant.deleteMany({ where: { productId: product.id } });
        if (options.length) await tx.productOption.createMany({ data: options.map((o) => ({ ...o, productId: product.id })) });
        await tx.productVariant.createMany({ data: variants.map((v) => ({ ...v, productId: product.id })) });
        if (images.length) {
          await tx.productImage.deleteMany({ where: { productId: product.id } });
          await tx.productImage.createMany({ data: images.map((i) => ({ ...i, productId: product.id })) });
        }
      });
      if (existing) result.updated++;
      else result.created++;
    } catch (e) {
      result.errors.push({ line, message: e instanceof Error ? e.message : "Invalid product." });
    }
  }
  return result;
}
