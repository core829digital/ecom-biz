/** Pure refund math, shared by the admin UI and the server. */

export type RefundableLine = {
  id: string;
  quantity: number;
  refundedQty: number;
  priceCents: number;
  discountCents: number;
  taxCents: number;
};

/** What the customer actually paid per unit of a line (after discount; plus tax when tax is added on top). */
export function paidPerUnit(line: RefundableLine, taxesIncluded: boolean): number {
  const lineTotal = line.priceCents * line.quantity - line.discountCents + (taxesIncluded ? 0 : line.taxCents);
  return line.quantity > 0 ? lineTotal / line.quantity : 0;
}

/** Suggested refund for selected quantities plus an optional shipping amount, capped by what remains refundable. */
export function suggestRefund(
  lines: RefundableLine[],
  selection: { lineId: string; quantity: number }[],
  shippingCents: number,
  taxesIncluded: boolean,
  remainingRefundableCents: number,
): number {
  let total = 0;
  for (const sel of selection) {
    const line = lines.find((l) => l.id === sel.lineId);
    if (!line) continue;
    const qty = Math.max(0, Math.min(sel.quantity, line.quantity - line.refundedQty));
    total += paidPerUnit(line, taxesIncluded) * qty;
  }
  return Math.max(0, Math.min(Math.round(total) + Math.max(0, shippingCents), remainingRefundableCents));
}

export function financialStatusAfterRefund(totalCents: number, refundedCents: number): "PAID" | "PARTIALLY_REFUNDED" | "REFUNDED" {
  if (refundedCents <= 0) return "PAID";
  return refundedCents >= totalCents ? "REFUNDED" : "PARTIALLY_REFUNDED";
}

export function fulfillmentStatusFor(lines: { quantity: number; fulfilledQty: number; refundedQty: number; requiresShipping: boolean }[]) {
  const shippable = lines.filter((l) => l.requiresShipping && l.quantity - l.refundedQty > 0);
  if (shippable.length === 0) return "FULFILLED" as const;
  const done = shippable.filter((l) => l.fulfilledQty >= l.quantity - l.refundedQty).length;
  const any = shippable.some((l) => l.fulfilledQty > 0);
  if (done === shippable.length) return "FULFILLED" as const;
  return any ? ("PARTIALLY_FULFILLED" as const) : ("UNFULFILLED" as const);
}
