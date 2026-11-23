import { describe, expect, it } from "vitest";
import { financialStatusAfterRefund, fulfillmentStatusFor, paidPerUnit, suggestRefund } from "@/lib/refunds";

const line = { id: "l1", quantity: 2, refundedQty: 0, priceCents: 1000, discountCents: 200, taxCents: 360 };

describe("refunds", () => {
  it("computes paid per unit with inclusive and exclusive tax", () => {
    expect(paidPerUnit(line, true)).toBe(900);
    expect(paidPerUnit(line, false)).toBe(1080);
  });
  it("suggests refunds capped by remaining and refundable quantity", () => {
    expect(suggestRefund([line], [{ lineId: "l1", quantity: 1 }], 0, true, 10_000)).toBe(900);
    expect(suggestRefund([line], [{ lineId: "l1", quantity: 5 }], 500, true, 10_000)).toBe(2300);
    expect(suggestRefund([line], [{ lineId: "l1", quantity: 2 }], 0, true, 1000)).toBe(1000);
    expect(suggestRefund([{ ...line, refundedQty: 2 }], [{ lineId: "l1", quantity: 1 }], 0, true, 10_000)).toBe(0);
  });
  it("derives financial status", () => {
    expect(financialStatusAfterRefund(1000, 0)).toBe("PAID");
    expect(financialStatusAfterRefund(1000, 400)).toBe("PARTIALLY_REFUNDED");
    expect(financialStatusAfterRefund(1000, 1000)).toBe("REFUNDED");
  });
  it("derives fulfillment status ignoring refunded and digital lines", () => {
    expect(fulfillmentStatusFor([{ quantity: 2, fulfilledQty: 0, refundedQty: 0, requiresShipping: true }])).toBe("UNFULFILLED");
    expect(fulfillmentStatusFor([{ quantity: 2, fulfilledQty: 1, refundedQty: 0, requiresShipping: true }])).toBe("PARTIALLY_FULFILLED");
    expect(fulfillmentStatusFor([{ quantity: 2, fulfilledQty: 1, refundedQty: 1, requiresShipping: true }])).toBe("FULFILLED");
    expect(fulfillmentStatusFor([{ quantity: 1, fulfilledQty: 0, refundedQty: 0, requiresShipping: false }])).toBe("FULFILLED");
  });
});
