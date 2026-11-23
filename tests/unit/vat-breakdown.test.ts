import { describe, expect, it } from "vitest";
import { vatBreakdown } from "@/lib/vat-breakdown";

const line = (priceCents: number, quantity: number, taxCents: number, discountCents = 0) => ({ priceCents, quantity, taxCents, discountCents });

describe("vatBreakdown", () => {
  it("splits a VAT-inclusive order with taxed shipping", () => {
    // 2 × 61.00 incl. 22% + shipping 6.10 incl. 22% = 128.10; VAT = 22.00 + 1.10
    const rows = vatBreakdown({ totalCents: 12810, taxCents: 2310, taxRateBps: 2200, shippingCents: 610 }, [line(6100, 2, 2200)]);
    expect(rows).toEqual([{ rateBps: 2200, baseCents: 10500, taxCents: 2310 }]);
  });

  it("separates exempt lines and untaxed shipping (VAT exclusive)", () => {
    // taxed 100.00 + 22.00 VAT, exempt 50.00, untaxed shipping 5.00 → total 177.00
    const rows = vatBreakdown({ totalCents: 17700, taxCents: 2200, taxRateBps: 2200, shippingCents: 500 }, [line(10000, 1, 2200), line(5000, 1, 0)]);
    expect(rows).toEqual([
      { rateBps: 2200, baseCents: 10000, taxCents: 2200 },
      { rateBps: 0, baseCents: 5500, taxCents: 0 },
    ]);
  });

  it("accounts for line discounts", () => {
    // 100.00 incl. VAT minus 10.00 discount = 90.00 incl. 16.23 VAT
    const rows = vatBreakdown({ totalCents: 9000, taxCents: 1623, taxRateBps: 2200, shippingCents: 0 }, [line(10000, 1, 1623, 1000)]);
    expect(rows).toEqual([{ rateBps: 2200, baseCents: 7377, taxCents: 1623 }]);
  });

  it("reports a single non-taxable row when there is no VAT", () => {
    expect(vatBreakdown({ totalCents: 4000, taxCents: 0, taxRateBps: 0, shippingCents: 0 }, [line(2000, 2, 0)])).toEqual([{ rateBps: 0, baseCents: 4000, taxCents: 0 }]);
  });

  it("bases always add up to the net total", () => {
    const order = { totalCents: 17700, taxCents: 2200, taxRateBps: 2200, shippingCents: 500 };
    const rows = vatBreakdown(order, [line(10000, 1, 2200), line(5000, 1, 0)]);
    expect(rows.reduce((s, r) => s + r.baseCents + r.taxCents, 0)).toBe(order.totalCents);
  });
});
