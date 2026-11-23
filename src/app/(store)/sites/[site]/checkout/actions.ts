"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { loadStorefront } from "@/server/storefront";
import { cartCookieName, getCart } from "@/server/cart";
import { buildQuote, type Quote } from "@/server/checkout";
import { shippableCountries } from "@/server/shipping";
import { availablePaymentMethods, type PaymentMethod } from "@/server/payments";
import { feeBpsForStore } from "@/server/plans";
import { completeCheckout, OutOfStockError } from "@/server/orders";
import { addressSchema } from "@/lib/address";
import { platformFee } from "@/lib/pricing";
import { getStripe } from "@/lib/stripe";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/http";
import { normalizeCode } from "@/server/discounts";
import type { Translator } from "@/lib/i18n";

export type QuoteView = {
  lines: { key: string; title: string; variantTitle: string | null; quantity: number; imageUrl: string | null; total: string }[];
  subtotal: string;
  discount: string | null;
  discountCode: string | null;
  shipping: string | null;
  tax: string;
  taxesIncluded: boolean;
  total: string;
  totalCents: number;
  rates: { id: string; title: string; price: string }[];
  selectedRateId: string | null;
  requiresShipping: boolean;
  discountError: string | null;
  stockError: string | null;
};

function discountMessage(t: Translator, e: Quote["discountError"], minimum: string): string | null {
  switch (e) {
    case null:
    case undefined:
      return null;
    case "min_subtotal":
      return t("checkout.discount.min", { amount: minimum });
    case "expired":
      return t("checkout.discount.expired");
    case "used_up":
      return t("checkout.discount.usedUp");
    case "already_used":
      return t("checkout.discount.alreadyUsed");
    default:
      return t("checkout.discount.invalid");
  }
}

async function toView(sf: Awaited<ReturnType<typeof loadStorefront>>, quote: Quote, code: string | null): Promise<QuoteView> {
  const p = quote.pricing;
  let minimum = "";
  if (quote.discountError === "min_subtotal" && code) {
    const d = await db.discount.findUnique({ where: { storeId_code: { storeId: sf.store.id, code: normalizeCode(code) } } });
    minimum = sf.money(d?.minSubtotalCents ?? 0);
  }
  return {
    lines: p.lines.map((l) => ({ key: l.variantId, title: l.title, variantTitle: l.variantTitle, quantity: l.quantity, imageUrl: l.imageUrl, total: sf.money(l.lineSubtotalCents) })),
    subtotal: sf.money(p.subtotalCents),
    discount: p.discountCents ? `−${sf.money(p.discountCents)}` : p.shippingDiscountCents ? sf.t("checkout.freeShipping") : null,
    discountCode: p.discountCode,
    shipping: !p.requiresShipping ? null : p.shippingRateId ? (p.shippingCents ? sf.money(p.shippingCents) : sf.t("checkout.free")) : null,
    tax: sf.money(p.taxCents),
    taxesIncluded: p.taxesIncluded,
    total: sf.money(p.totalCents),
    totalCents: p.totalCents,
    rates: quote.rates.map((r) => ({ id: r.id, title: r.title, price: r.priceCents ? sf.money(r.priceCents) : sf.t("checkout.free") })),
    selectedRateId: p.shippingRateId,
    requiresShipping: p.requiresShipping,
    discountError: discountMessage(sf.t, quote.discountError, minimum),
    stockError: quote.stockProblems.length ? sf.t("checkout.stockChanged") : null,
  };
}

const quoteInput = z.object({
  countryCode: z.string().max(2).nullable().optional(),
  shippingRateId: z.string().max(40).nullable().optional(),
  discountCode: z.string().max(60).nullable().optional(),
  email: z.string().max(200).nullable().optional(),
});

export async function quoteAction(site: string, raw: unknown): Promise<QuoteView | { error: string }> {
  const sf = await loadStorefront(site);
  const cart = await getCart(sf.store.id);
  if (!cart || !cart.lines.length) return { error: sf.t("sf.cart.empty") };
  const input = quoteInput.safeParse(raw);
  if (!input.success) return { error: sf.t("products.error.invalid") };
  const quote = await buildQuote(sf.store, cart, input.data);
  // Persist a valid code on the cart so it survives reloads.
  if (input.data.discountCode !== undefined) {
    const code = quote.pricing.discountCode ?? null;
    if (code !== cart.discountCode) await db.cart.update({ where: { id: cart.id }, data: { discountCode: input.data.discountCode ? code : null } });
  }
  return toView(sf, quote, input.data.discountCode ?? cart.discountCode);
}

const placeInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(40).optional().default(""),
  acceptsMarketing: z.boolean().default(false),
  note: z.string().max(1000).optional().default(""),
  address: addressSchema,
  shippingRateId: z.string().max(40).nullable().optional(),
  discountCode: z.string().max(60).nullable().optional(),
  paymentMethod: z.enum(["stripe", "cod", "bank_transfer", "test"]),
});

export type PlaceResult =
  | { ok: true; redirect: string }
  | { ok: true; clientSecret: string; returnUrl: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Never surface raw exceptions to shoppers: log them and return a friendly error. */
export async function placeOrderAction(site: string, raw: unknown): Promise<PlaceResult> {
  try {
    return await placeOrder(site, raw);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e; // let Next handle redirect()/notFound()
    console.error("[checkout] unexpected", e);
    const sf = await loadStorefront(site);
    return { ok: false, error: sf.t("checkout.paymentFailed") };
  }
}

async function placeOrder(site: string, raw: unknown): Promise<PlaceResult> {
  const sf = await loadStorefront(site);
  const { store, t } = sf;
  if (!sf.operational) return { ok: false, error: t("sf.unavailable") };
  if (!(await rateLimit(`checkout:${store.id}:${await clientIp()}`, 30, 600))) return { ok: false, error: t("auth.error.rateLimited") };

  const parsed = placeInput.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[i.path.join(".")] ??= i.path.includes("email") ? t("validation.email") : t("validation.required");
    return { ok: false, error: t("validation.fixErrors"), fieldErrors };
  }
  const input = parsed.data;
  if (store.checkoutRequirePhone && !input.phone && !input.address.phone) {
    return { ok: false, error: t("validation.fixErrors"), fieldErrors: { phone: t("validation.required") } };
  }
  const methods = availablePaymentMethods(store);

  const cart = await getCart(store.id);
  if (!cart || !cart.lines.length) return { ok: false, error: t("sf.cart.empty") };
  const quote = await buildQuote(store, cart, {
    countryCode: input.address.countryCode,
    shippingRateId: input.shippingRateId,
    discountCode: input.discountCode,
    email: input.email,
  });
  const p = quote.pricing;
  if (!p.lines.length) return { ok: false, error: t("sf.cart.empty") };
  if (quote.stockProblems.length) return { ok: false, error: t("checkout.stockChanged") };
  if (input.discountCode && !p.discountCode) return { ok: false, error: discountMessage(t, quote.discountError, "") ?? t("checkout.discount.invalid") };
  if (p.requiresShipping) {
    const countries = await shippableCountries(store.id);
    if (!countries.includes(input.address.countryCode)) return { ok: false, error: t("checkout.noShipping"), fieldErrors: { "address.countryCode": t("checkout.noShipping") } };
    if (!p.shippingRateId || (input.shippingRateId && p.shippingRateId !== input.shippingRateId)) return { ok: false, error: t("checkout.chooseShipping") };
  }

  const free = p.totalCents === 0;
  const method: PaymentMethod | "free" = free ? "free" : input.paymentMethod;
  if (!free && !methods.includes(input.paymentMethod)) return { ok: false, error: t("checkout.paymentUnavailable") };

  const fee = method === "stripe" ? platformFee(p.totalCents, await feeBpsForStore(store)) : 0;

  const checkout = await db.checkout.create({
    data: {
      storeId: store.id,
      cartId: cart.id,
      email: input.email,
      phone: input.phone || input.address.phone || null,
      shippingAddress: input.address,
      shippingRateId: p.shippingRateId,
      pricing: JSON.parse(JSON.stringify(p)),
      paymentMethod: method,
      platformFeeCents: fee,
      acceptsMarketing: input.acceptsMarketing,
      note: input.note || cart.note || null,
    },
  });

  const clearCart = async () => (await cookies()).delete(cartCookieName(store.id));

  if (method === "stripe") {
    const stripe = getStripe();
    if (!stripe || !store.stripeAccountId) return { ok: false, error: t("checkout.paymentUnavailable") };
    // Retire earlier unpaid card attempts for this cart.
    const stale = await db.checkout.findMany({ where: { cartId: cart.id, status: "OPEN", paymentMethod: "stripe", id: { not: checkout.id }, paymentRef: { not: null } } });
    for (const s of stale) {
      await stripe.paymentIntents.cancel(s.paymentRef!).catch(() => undefined);
      await db.checkout.update({ where: { id: s.id }, data: { status: "EXPIRED" } });
    }
    try {
      const pi = await stripe.paymentIntents.create(
        {
          amount: p.totalCents,
          currency: store.currency.toLowerCase(),
          automatic_payment_methods: { enabled: true },
          receipt_email: input.email,
          description: `${store.name} order`,
          metadata: { checkoutId: checkout.id, storeId: store.id },
          on_behalf_of: store.stripeAccountId,
          transfer_data: { destination: store.stripeAccountId },
          ...(fee > 0 ? { application_fee_amount: fee } : {}),
        },
        { idempotencyKey: `checkout-${checkout.id}` },
      );
      await db.checkout.update({ where: { id: checkout.id }, data: { paymentRef: pi.id } });
      return { ok: true, clientSecret: pi.client_secret!, returnUrl: `${sf.publicUrl}/checkout/complete?checkout=${checkout.id}` };
    } catch (e) {
      console.error("[checkout] stripe", e);
      await db.checkout.update({ where: { id: checkout.id }, data: { status: "EXPIRED" } });
      return { ok: false, error: t("checkout.paymentFailed") };
    }
  }

  try {
    const paid = method === "test" || method === "free";
    const { orderId } = await completeCheckout(checkout.id, { paid, enforceStock: true });
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, select: { statusToken: true } });
    await clearCart();
    return { ok: true, redirect: sf.href(`/orders/${order.statusToken}`) };
  } catch (e) {
    await db.checkout.update({ where: { id: checkout.id }, data: { status: "EXPIRED" } }).catch(() => undefined);
    if (e instanceof OutOfStockError) return { ok: false, error: t("checkout.outOfStock", { title: e.title }) };
    console.error("[checkout] complete", e);
    return { ok: false, error: t("checkout.paymentFailed") };
  }
}
