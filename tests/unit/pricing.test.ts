import { describe, expect, it } from "vitest";
import { allocate, platformFee, priceCart, taxFor, type PricingLineInput } from "@/lib/pricing";

const line = (over: Partial<PricingLineInput> = {}): PricingLineInput => ({
  variantId: "v1", productId: "p1", title: "Tee", variantTitle: null, sku: null, imageUrl: null,
  quantity: 1, unitPriceCents: 1000, taxable: true, requiresShipping: true, weightGrams: 200, ...over,
});

describe("allocate", () => {
  it("always sums to the total", () => {
    for (const [total, weights] of [[100, [1, 1, 1]], [7, [3, 3, 3]], [1, [5, 5]], [999, [1, 2, 3, 4]]] as [number, number[]][]) {
      expect(allocate(total, weights).reduce((a, b) => a + b, 0)).toBe(total);
    }
  });
  it("is proportional", () => {
    expect(allocate(100, [1, 3])).toEqual([25, 75]);
    expect(allocate(0, [1, 2])).toEqual([0, 0]);
    expect(allocate(10, [0, 0])).toEqual([0, 0]);
  });
});

describe("taxFor", () => {
  it("extracts inclusive VAT and adds exclusive tax", () => {
    expect(taxFor(12100, 2100, true)).toBe(2100); // 121.00 incl. 21% → 21.00
    expect(taxFor(10000, 2100, false)).toBe(2100);
    expect(taxFor(10000, 0, false)).toBe(0);
  });
});

describe("priceCart", () => {
  const base = { taxRateBps: 2100, taxesIncluded: true, taxShipping: true };

  it("tax-inclusive cart: total equals subtotal + shipping, tax is informational", () => {
    const r = priceCart({ ...base, lines: [line({ quantity: 2, unitPriceCents: 12100 })], shipping: { rateId: "r", title: "Std", priceCents: 1210 } });
    expect(r.subtotalCents).toBe(24200);
    expect(r.totalCents).toBe(25410);
    expect(r.taxCents).toBe(4200 + 210);
  });

  it("tax-exclusive cart adds tax on top", () => {
    const r = priceCart({ ...base, taxesIncluded: false, lines: [line({ unitPriceCents: 10000 })], shipping: { rateId: "r", title: "Std", priceCents: 1000 } });
    expect(r.taxCents).toBe(2100 + 210);
    expect(r.totalCents).toBe(10000 + 1000 + 2310);
  });

  it("percentage discount allocates across lines and reduces tax base", () => {
    const r = priceCart({
      ...base,
      taxesIncluded: false,
      taxRateBps: 1000,
      lines: [line({ unitPriceCents: 3000 }), line({ variantId: "v2", unitPriceCents: 1000 })],
      discount: { code: "TEN", type: "PERCENTAGE", value: 1000, minSubtotalCents: 0 },
    });
    expect(r.discountCents).toBe(400);
    expect(r.lines.map((l) => l.discountCents)).toEqual([300, 100]);
    expect(r.taxCents).toBe(270 + 90);
    expect(r.totalCents).toBe(4000 - 400 + 360);
    expect(r.discountCode).toBe("TEN");
  });

  it("fixed discount never exceeds subtotal", () => {
    const r = priceCart({ ...base, lines: [line({ unitPriceCents: 500 })], discount: { code: "BIG", type: "FIXED_AMOUNT", value: 9999, minSubtotalCents: 0 } });
    expect(r.discountCents).toBe(500);
    expect(r.totalCents).toBe(0);
  });

  it("free shipping zeroes shipping and keeps items", () => {
    const r = priceCart({ ...base, lines: [line()], shipping: { rateId: "r", title: "Std", priceCents: 700 }, discount: { code: "SHIP", type: "FREE_SHIPPING", value: 0, minSubtotalCents: 0 } });
    expect(r.shippingCents).toBe(0);
    expect(r.shippingDiscountCents).toBe(700);
    expect(r.totalCents).toBe(1000);
  });

  it("reports a discount below its minimum without applying it", () => {
    const r = priceCart({ ...base, lines: [line()], discount: { code: "MIN", type: "PERCENTAGE", value: 5000, minSubtotalCents: 5000 } });
    expect(r.discountCents).toBe(0);
    expect(r.discountError).toBe("min_subtotal");
    expect(r.discountCode).toBeNull();
  });

  it("ignores shipping for digital-only carts and skips untaxable lines", () => {
    const r = priceCart({ ...base, lines: [line({ requiresShipping: false, taxable: false })], shipping: { rateId: "r", title: "Std", priceCents: 500 } });
    expect(r.requiresShipping).toBe(false);
    expect(r.shippingCents).toBe(0);
    expect(r.taxCents).toBe(0);
    expect(r.totalCents).toBe(1000);
  });

  it("can skip tax on shipping", () => {
    const r = priceCart({ ...base, taxesIncluded: false, taxShipping: false, lines: [line()], shipping: { rateId: "r", title: "Std", priceCents: 1000 } });
    expect(r.taxCents).toBe(210);
  });
});

describe("platformFee", () => {
  it("computes and clamps", () => {
    expect(platformFee(10000, 200)).toBe(200);
    expect(platformFee(100, 20000)).toBe(100);
    expect(platformFee(1000, 0)).toBe(0);
  });
});
