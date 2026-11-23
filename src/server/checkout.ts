import "server-only";
import type { Store } from "@prisma/client";
import { priceCart, type PricingLineInput, type PricingResult } from "@/lib/pricing";
import { maxPurchasable, type CartWithLines } from "@/server/cart";
import { checkDiscount, type DiscountCheck } from "@/server/discounts";
import { ratesFor, taxRateFor, type RateOption } from "@/server/shipping";

export type QuoteInput = { countryCode?: string | null; shippingRateId?: string | null; discountCode?: string | null; email?: string | null };

export type Quote = {
  pricing: PricingResult;
  rates: RateOption[];
  stockProblems: { variantId: string; available: number }[];
  discountError: DiscountCheck["error"] | "min_subtotal" | null;
};

/** Convert cart lines to pricing input using current DB prices (never client-supplied). */
export function cartToPricingLines(cart: CartWithLines): PricingLineInput[] {
  return cart.lines
    .filter((l) => l.variant.product.status === "ACTIVE" && l.variant.product.storeId === cart.storeId)
    .map((l) => ({
      variantId: l.variant.id,
      productId: l.variant.product.id,
      title: l.variant.product.title,
      variantTitle: l.variant.title === "Default" ? null : l.variant.title,
      sku: l.variant.sku,
      imageUrl: l.variant.product.images[0]?.url ?? null,
      quantity: l.quantity,
      unitPriceCents: l.variant.priceCents,
      taxable: l.variant.taxable,
      requiresShipping: l.variant.requiresShipping,
      weightGrams: l.variant.weightGrams,
    }));
}

/** Full server-side quote for a cart and the customer's current checkout choices. */
export async function buildQuote(store: Store, cart: CartWithLines, input: QuoteInput): Promise<Quote> {
  const lines = cartToPricingLines(cart);
  const stockProblems = cart.lines
    .filter((l) => l.quantity > maxPurchasable(l.variant))
    .map((l) => ({ variantId: l.variant.id, available: maxPurchasable(l.variant) }));
  const subtotal = lines.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0);
  const country = input.countryCode?.toUpperCase() || null;

  const rates = country ? await ratesFor(store.id, country, subtotal) : [];
  const rate = rates.find((r) => r.id === input.shippingRateId) ?? rates[0] ?? null;
  const taxRateBps = country ? await taxRateFor(store.id, country) : 0;

  let discountError: Quote["discountError"] = null;
  let discount = null;
  const code = input.discountCode || cart.discountCode;
  if (code) {
    const check = await checkDiscount(store.id, code, input.email);
    if (check.discount) discount = check.discount;
    else discountError = check.error;
  }

  const pricing = priceCart({
    lines,
    discount: discount ? { code: discount.code, type: discount.type, value: discount.value, minSubtotalCents: discount.minSubtotalCents } : null,
    shipping: rate ? { rateId: rate.id, title: rate.title, priceCents: rate.priceCents } : null,
    taxRateBps,
    taxesIncluded: store.taxesIncluded,
    taxShipping: store.taxShipping,
  });
  if (pricing.discountError) discountError = pricing.discountError;
  return { pricing, rates, stockProblems, discountError };
}
