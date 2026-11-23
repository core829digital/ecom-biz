import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { centsToInput } from "@/lib/money";
import { toCsv } from "@/lib/csv";
import { PRODUCT_CSV_HEADERS } from "@/server/product-csv";

export async function GET(_req: Request, { params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const { store } = await requireStoreAccess(slug);
  const products = await db.product.findMany({
    where: { storeId: store.id },
    include: { options: { orderBy: { position: "asc" } }, variants: { orderBy: { position: "asc" } }, images: { orderBy: { position: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
  const rows: unknown[][] = [PRODUCT_CSV_HEADERS];
  for (const p of products) {
    const n = Math.max(p.variants.length, p.images.length);
    for (let i = 0; i < n; i++) {
      const v = p.variants[i];
      const img = p.images[i];
      const first = i === 0;
      rows.push([
        p.handle,
        first ? p.title : "",
        first ? p.description : "",
        first ? p.vendor : "",
        first ? p.productType : "",
        first ? p.tags.join(", ") : "",
        first ? p.status.toLowerCase() : "",
        first ? p.options[0]?.name : "", v?.option1 ?? "",
        first ? p.options[1]?.name : "", v?.option2 ?? "",
        first ? p.options[2]?.name : "", v?.option3 ?? "",
        v?.sku ?? "", v?.barcode ?? "",
        v ? centsToInput(v.priceCents) : "", v ? centsToInput(v.compareAtCents) : "", v ? centsToInput(v.costCents) : "",
        v?.inventoryQty ?? "", v ? String(v.trackInventory) : "", v ? String(v.allowBackorder) : "",
        v ? String(v.requiresShipping) : "", v ? String(v.taxable) : "", v?.weightGrams ?? "",
        img?.url ?? "", img?.alt ?? "",
        first ? p.seoTitle : "", first ? p.seoDescription : "",
      ]);
    }
  }
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="products-${store.slug}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
