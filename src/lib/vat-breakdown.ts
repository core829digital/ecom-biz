import type { Order, OrderLine } from "@prisma/client";

export type VatRow = { rateBps: number; baseCents: number; taxCents: number };

/**
 * Split an order into VAT rows (taxed at the order rate, and exempt). Pure, so
 * it is unit-tested. Lines with no tax are exempt; shipping is taxed when the
 * order tax exceeds the sum of the line taxes.
 */
export function vatBreakdown(order: Pick<Order, "totalCents" | "taxCents" | "taxRateBps" | "shippingCents">, lines: Pick<OrderLine, "priceCents" | "quantity" | "discountCents" | "taxCents">[]): VatRow[] {
  const lineTax = lines.reduce((s, l) => s + l.taxCents, 0);
  const shippingTaxed = order.taxCents - lineTax > 0;
  const exemptGross =
    lines.filter((l) => l.taxCents === 0).reduce((s, l) => s + l.priceCents * l.quantity - l.discountCents, 0) + (shippingTaxed ? 0 : order.shippingCents);
  const net = order.totalCents - order.taxCents;
  const rows: VatRow[] = [];
  if (order.taxCents > 0) rows.push({ rateBps: order.taxRateBps, baseCents: Math.max(0, net - exemptGross), taxCents: order.taxCents });
  if (exemptGross > 0 || rows.length === 0) rows.push({ rateBps: 0, baseCents: order.taxCents > 0 ? exemptGross : net, taxCents: 0 });
  return rows;
}
