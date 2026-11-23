import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { toCsv } from "@/lib/csv";
import { centsToInput } from "@/lib/money";
import { ordersWhere } from "@/server/order-queries";
import type { Address } from "@/lib/address";

export async function GET(req: Request, { params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const { store } = await requireStoreAccess(slug);
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const orders = await db.order.findMany({ where: ordersWhere(store.id, sp), include: { lines: true }, orderBy: { number: "asc" }, take: 20000 });
  const rows: unknown[][] = [[
    "Order", "Date", "Email", "Status", "Financial status", "Fulfillment status", "Payment method", "Currency", "Subtotal", "Discount", "Discount code",
    "Shipping", "Taxes", "Total", "Refunded", "Shipping name", "Address", "City", "Zip", "Country", "Phone", "Line title", "Line variant", "Line SKU", "Line qty", "Line price",
  ]];
  for (const o of orders) {
    const a = (o.shippingAddress ?? {}) as Partial<Address>;
    o.lines.forEach((l, i) => {
      const first = i === 0;
      rows.push([
        o.number, first ? o.createdAt.toISOString() : "", first ? o.email : "", first ? o.status : "", first ? o.financialStatus : "", first ? o.fulfillmentStatus : "",
        first ? o.paymentMethod : "", first ? o.currency : "", first ? centsToInput(o.subtotalCents) : "", first ? centsToInput(o.discountCents) : "", first ? o.discountCode : "",
        first ? centsToInput(o.shippingCents) : "", first ? centsToInput(o.taxCents) : "", first ? centsToInput(o.totalCents) : "", first ? centsToInput(o.refundedCents) : "",
        first ? [a.firstName, a.lastName].filter(Boolean).join(" ") : "", first ? [a.address1, a.address2].filter(Boolean).join(", ") : "", first ? a.city : "", first ? a.zip : "",
        first ? a.countryCode : "", first ? o.phone : "", l.title, l.variantTitle, l.sku, l.quantity, centsToInput(l.priceCents),
      ]);
    });
  }
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders-${store.slug}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
