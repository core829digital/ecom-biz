import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { randomToken } from "@/lib/crypto";
import type { PricingResult } from "@/lib/pricing";
import type { Address } from "@/lib/address";
import { parseManualPayments } from "@/server/payments";
import { sendMerchantNewOrder, sendOrderConfirmation } from "@/server/emails";
import { emitWebhook } from "@/server/webhooks";
import { getTranslator } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { notifyStore, recentlyNotified } from "@/server/notifications";

export class OutOfStockError extends Error {
  constructor(public title: string) {
    super(`Out of stock: ${title}`);
  }
}

export class DiscountUnavailableError extends Error {
  constructor(public code: string) {
    super(`Discount no longer available: ${code}`);
  }
}

export type CompleteOptions = {
  /** Payment already captured (card/test) → PAID; manual methods stay PENDING. */
  paid: boolean;
  /** When true, refuse to oversell non-backorder variants (manual payments). For captured payments we never drop a paid order. */
  enforceStock: boolean;
};

/** Public shape of an order for webhooks and the Admin API. */
export function orderPayload(o: Prisma.OrderGetPayload<{ include: { lines: true } }>) {
  return {
    id: o.id,
    number: o.number,
    email: o.email,
    currency: o.currency,
    subtotal: o.subtotalCents,
    discount: o.discountCents,
    shipping: o.shippingCents,
    tax: o.taxCents,
    total: o.totalCents,
    refunded: o.refundedCents,
    taxes_included: o.taxesIncluded,
    financial_status: o.financialStatus.toLowerCase(),
    fulfillment_status: o.fulfillmentStatus.toLowerCase(),
    status: o.status.toLowerCase(),
    payment_method: o.paymentMethod,
    discount_code: o.discountCode,
    shipping_method: o.shippingTitle,
    shipping_address: o.shippingAddress,
    note: o.note,
    created_at: o.createdAt.toISOString(),
    lines: o.lines.map((l) => ({
      id: l.id,
      product_id: l.productId,
      variant_id: l.variantId,
      title: l.title,
      variant_title: l.variantTitle,
      sku: l.sku,
      quantity: l.quantity,
      price: l.priceCents,
      discount: l.discountCents,
      tax: l.taxCents,
      fulfilled_quantity: l.fulfilledQty,
      refunded_quantity: l.refundedQty,
    })),
  };
}

/**
 * Turn an OPEN checkout into an order. Idempotent and safe under concurrency:
 * the checkout row is locked, so a Stripe webhook and the customer's return page
 * racing each other produce exactly one order.
 */
export async function completeCheckout(checkoutId: string, opts: CompleteOptions): Promise<{ orderId: string; created: boolean }> {
  const result = await db.$transaction(
    async (tx) => {
      const locked = await tx.$queryRaw<{ id: string; status: string; orderId: string | null }[]>`
        SELECT "id", "status"::text, "orderId" FROM "Checkout" WHERE "id" = ${checkoutId} FOR UPDATE`;
      const row = locked[0];
      if (!row) throw new Error(`Checkout ${checkoutId} not found`);
      if (row.status === "COMPLETED" && row.orderId) return { orderId: row.orderId, created: false as const };

      const checkout = await tx.checkout.findUniqueOrThrow({ where: { id: checkoutId }, include: { store: true } });
      const store = checkout.store;
      const pricing = checkout.pricing as unknown as PricingResult;
      const shippingAddress = checkout.shippingAddress as unknown as Address;
      const warnings: string[] = [];
      const et = getTranslator(store.locale);

      // Inventory: decrement atomically.
      for (const line of pricing.lines) {
        const variant = await tx.productVariant.findFirst({
          where: { id: line.variantId, product: { storeId: store.id } },
          select: { id: true, trackInventory: true, allowBackorder: true },
        });
        if (!variant || !variant.trackInventory) continue;
        if (opts.enforceStock && !variant.allowBackorder) {
          const res = await tx.productVariant.updateMany({
            where: { id: variant.id, inventoryQty: { gte: line.quantity } },
            data: { inventoryQty: { decrement: line.quantity } },
          });
          if (res.count === 0) throw new OutOfStockError(line.title);
        } else {
          const updated = await tx.productVariant.update({
            where: { id: variant.id },
            data: { inventoryQty: { decrement: line.quantity } },
            select: { inventoryQty: true },
          });
          if (updated.inventoryQty < 0 && !variant.allowBackorder) warnings.push(et("event.oversold", { title: `${line.title}${line.variantTitle ? ` (${line.variantTitle})` : ""}` }));
        }
      }

      // Discount usage limit: incremented atomically and only while below the limit, so concurrent
      // checkouts can't exceed it. A captured card payment is never dropped: it is flagged instead.
      if (pricing.discountCode) {
        const used = await tx.$executeRaw`
          UPDATE "Discount" SET "usageCount" = "usageCount" + 1
          WHERE "storeId" = ${store.id} AND "code" = ${pricing.discountCode} AND ("usageLimit" IS NULL OR "usageCount" < "usageLimit")`;
        if (used === 0) {
          if (opts.enforceStock) throw new DiscountUnavailableError(pricing.discountCode);
          warnings.push(et("event.discountOverLimit", { code: pricing.discountCode }));
        }
      }

      // Snapshot unit costs so profit reports stay correct if costs change later.
      const costRows = await tx.productVariant.findMany({ where: { id: { in: pricing.lines.map((l) => l.variantId) } }, select: { id: true, costCents: true } });
      const unitCost = new Map(costRows.map((r) => [r.id, r.costCents]));

      const { orderCounter: number } = await tx.store.update({
        where: { id: store.id },
        data: { orderCounter: { increment: 1 } },
        select: { orderCounter: true },
      });

      const email = checkout.email.toLowerCase();
      const customer = await tx.customer.upsert({
        where: { storeId_email: { storeId: store.id, email } },
        create: {
          storeId: store.id,
          email,
          firstName: shippingAddress.firstName,
          lastName: shippingAddress.lastName,
          phone: checkout.phone || shippingAddress.phone || null,
          acceptsMarketing: checkout.acceptsMarketing,
        },
        update: checkout.acceptsMarketing ? { acceptsMarketing: true } : {},
      });

      const manual = parseManualPayments(store.manualPayments);
      const paymentInstructions =
        checkout.paymentMethod === "bank_transfer"
          ? manual.bankTransfer.instructions || null
          : checkout.paymentMethod === "cod"
            ? manual.cod.instructions || null
            : null;

      const order = await tx.order.create({
        data: {
          storeId: store.id,
          number,
          statusToken: randomToken(24),
          customerId: customer.id,
          email,
          phone: checkout.phone || shippingAddress.phone || null,
          currency: store.currency,
          subtotalCents: pricing.subtotalCents,
          discountCents: pricing.discountCents,
          shippingCents: pricing.shippingCents,
          taxCents: pricing.taxCents,
          totalCents: pricing.totalCents,
          taxesIncluded: pricing.taxesIncluded,
          taxRateBps: pricing.taxRateBps,
          discountCode: pricing.discountCode,
          shippingTitle: pricing.requiresShipping ? pricing.shippingTitle : null,
          shippingAddress: checkout.shippingAddress as Prisma.InputJsonValue,
          billingAddress: (checkout.billingAddress ?? checkout.shippingAddress) as Prisma.InputJsonValue,
          note: checkout.note,
          financialStatus: opts.paid ? "PAID" : "PENDING",
          fulfillmentStatus: pricing.requiresShipping ? "UNFULFILLED" : "FULFILLED",
          paymentMethod: checkout.paymentMethod,
          paymentRef: checkout.paymentRef,
          paymentInstructions,
          platformFeeCents: checkout.platformFeeCents,
          lines: {
            create: pricing.lines.map((l) => ({
              productId: l.productId,
              variantId: l.variantId,
              title: l.title,
              variantTitle: l.variantTitle,
              sku: l.sku,
              imageUrl: l.imageUrl,
              quantity: l.quantity,
              priceCents: l.unitPriceCents,
              costCents: unitCost.get(l.variantId) ?? null,
              discountCents: l.discountCents,
              taxCents: l.taxCents,
              requiresShipping: l.requiresShipping,
              fulfilledQty: l.requiresShipping ? 0 : l.quantity,
            })),
          },
          events: {
            create: [
              { type: "placed", message: et("event.placed", { method: et(`checkout.method.${checkout.paymentMethod as "cod"}`) }) },
              ...(opts.paid ? [{ type: "paid", message: et("event.paid") }] : []),
              ...warnings.map((w) => ({ type: "warning", message: w })),
            ],
          },
        },
        include: { lines: true },
      });

      await tx.checkout.update({ where: { id: checkout.id }, data: { status: "COMPLETED", orderId: order.id } });
      const cartBefore = await tx.cart.findUnique({ where: { id: checkout.cartId }, select: { recoveryEmailSentAt: true } });
      await tx.cart.update({
        where: { id: checkout.cartId },
        data: { completedAt: new Date(), ...(cartBefore?.recoveryEmailSentAt ? { recoveredAt: new Date() } : {}) },
      });
      return { orderId: order.id, created: true as const, order, store, newCustomer: customer.createdAt.getTime() === customer.updatedAt.getTime() };
    },
    { isolationLevel: "ReadCommitted", timeout: 20_000 },
  );

  if (result.created) {
    const { order, store } = result;
    // Side effects after commit; failures here never roll back the order.
    await Promise.allSettled([
      sendOrderConfirmation(store, order),
      sendMerchantNewOrder(store, order),
      emitWebhook(store.id, "orders/create", orderPayload(order)),
      order.financialStatus === "PAID" ? emitWebhook(store.id, "orders/paid", orderPayload(order)) : Promise.resolve(),
      result.newCustomer ? emitWebhook(store.id, "customers/create", { id: order.customerId, email: order.email }) : Promise.resolve(),
      notifyStore(store.id, {
        type: "order_new",
        data: { number: order.number, total: formatMoney(order.totalCents, order.currency, store.locale), email: order.email },
        href: `/admin/${store.slug}/orders/${order.id}`,
      }),
      notifyLowStock(store, order.lines.map((l) => l.variantId).filter((v): v is string => !!v)),
    ]);
  }
  return { orderId: result.orderId, created: result.created };
}

const LOW_STOCK = 3;

/** Tell the team when a sale leaves a tracked variant at or below the low-stock level (once a day per variant). */
async function notifyLowStock(store: { id: string; slug: string }, variantIds: string[]) {
  if (!variantIds.length) return;
  const low = await db.productVariant.findMany({
    where: { id: { in: variantIds }, trackInventory: true, allowBackorder: false, inventoryQty: { lte: LOW_STOCK }, product: { storeId: store.id } },
    select: { id: true, title: true, inventoryQty: true, product: { select: { id: true, title: true } } },
  });
  for (const v of low) {
    if (await recentlyNotified(store.id, "low_stock", v.id)) continue;
    const title = v.title === "Default" ? v.product.title : `${v.product.title} (${v.title})`;
    await notifyStore(store.id, { type: "low_stock", data: { key: v.id, title, qty: v.inventoryQty }, href: `/admin/${store.slug}/products/${v.product.id}` });
  }
}
