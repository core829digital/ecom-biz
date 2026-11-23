/**
 * Pure pricing engine. Single source of truth for cart, checkout and order totals.
 * All amounts are integer minor units; rates are basis points.
 */

export type PricingLineInput = {
  variantId: string;
  productId: string;
  title: string;
  variantTitle: string | null;
  sku: string | null;
  imageUrl: string | null;
  quantity: number;
  unitPriceCents: number;
  taxable: boolean;
  requiresShipping: boolean;
  weightGrams: number;
};

export type DiscountInput = {
  code: string;
  type: "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING";
  value: number;
  minSubtotalCents: number;
};

export type ShippingInput = { rateId: string; title: string; priceCents: number } | null;

export type PricingInput = {
  lines: PricingLineInput[];
  discount?: DiscountInput | null;
  shipping?: ShippingInput;
  taxRateBps: number;
  taxesIncluded: boolean;
  taxShipping: boolean;
};

export type PricedLine = PricingLineInput & { lineSubtotalCents: number; discountCents: number; taxCents: number };

export type PricingResult = {
  lines: PricedLine[];
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  shippingDiscountCents: number;
  taxCents: number;
  totalCents: number;
  taxesIncluded: boolean;
  taxRateBps: number;
  requiresShipping: boolean;
  totalWeightGrams: number;
  discountCode: string | null;
  discountType: DiscountInput["type"] | null;
  /** Set when a code was provided but cannot apply (e.g. minimum not reached). */
  discountError: "min_subtotal" | null;
  shippingRateId: string | null;
  shippingTitle: string | null;
};

/**
 * Split `total` across `weights` proportionally; remainders go to the largest
 * fractional parts so the parts always sum exactly to `total`.
 */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (total <= 0 || sum <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const floors = raw.map(Math.floor);
  let rest = total - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (rest <= 0) break;
    floors[i]++;
    rest--;
  }
  return floors;
}

/** Tax contained in (inclusive) or added on top of (exclusive) an amount. */
export function taxFor(amount: number, rateBps: number, inclusive: boolean): number {
  if (amount <= 0 || rateBps <= 0) return 0;
  return inclusive ? Math.round((amount * rateBps) / (10000 + rateBps)) : Math.round((amount * rateBps) / 10000);
}

export function priceCart(input: PricingInput): PricingResult {
  const lines = input.lines.filter((l) => l.quantity > 0);
  const lineSubtotals = lines.map((l) => l.unitPriceCents * l.quantity);
  const subtotalCents = lineSubtotals.reduce((a, b) => a + b, 0);
  const requiresShipping = lines.some((l) => l.requiresShipping);
  const totalWeightGrams = lines.reduce((s, l) => s + (l.requiresShipping ? l.weightGrams * l.quantity : 0), 0);

  let discountCents = 0;
  let shippingDiscountCents = 0;
  let discountError: PricingResult["discountError"] = null;
  const d = input.discount ?? null;
  const applies = d ? subtotalCents >= d.minSubtotalCents : false;
  if (d && !applies) discountError = "min_subtotal";

  const shipping = requiresShipping ? input.shipping ?? null : null;
  const shippingBase = shipping?.priceCents ?? 0;

  if (d && applies) {
    if (d.type === "PERCENTAGE") discountCents = Math.min(subtotalCents, Math.round((subtotalCents * Math.min(d.value, 10000)) / 10000));
    else if (d.type === "FIXED_AMOUNT") discountCents = Math.min(subtotalCents, Math.max(0, d.value));
    else shippingDiscountCents = shippingBase;
  }
  const lineDiscounts = allocate(discountCents, lineSubtotals);
  const shippingCents = shippingBase - shippingDiscountCents;

  const priced: PricedLine[] = lines.map((l, i) => {
    const net = lineSubtotals[i] - lineDiscounts[i];
    return {
      ...l,
      lineSubtotalCents: lineSubtotals[i],
      discountCents: lineDiscounts[i],
      taxCents: l.taxable ? taxFor(net, input.taxRateBps, input.taxesIncluded) : 0,
    };
  });
  const shippingTax = input.taxShipping ? taxFor(shippingCents, input.taxRateBps, input.taxesIncluded) : 0;
  const taxCents = priced.reduce((s, l) => s + l.taxCents, 0) + shippingTax;
  const totalCents = subtotalCents - discountCents + shippingCents + (input.taxesIncluded ? 0 : taxCents);

  return {
    lines: priced,
    subtotalCents,
    discountCents,
    shippingCents,
    shippingDiscountCents,
    taxCents,
    totalCents,
    taxesIncluded: input.taxesIncluded,
    taxRateBps: input.taxRateBps,
    requiresShipping,
    totalWeightGrams,
    discountCode: d && applies ? d.code : null,
    discountType: d && applies ? d.type : null,
    discountError,
    shippingRateId: shipping?.rateId ?? null,
    shippingTitle: shipping?.title ?? null,
  };
}

/** Platform application fee for a payment. */
export function platformFee(totalCents: number, feeBps: number): number {
  return Math.max(0, Math.min(totalCents, Math.round((totalCents * feeBps) / 10000)));
}
