import "server-only";
import type { Store } from "@prisma/client";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { financialStatusAfterRefund, fulfillmentStatusFor } from "@/lib/refunds";
import { sendOrderCancelled, sendRefundNotification, sendShippingConfirmation } from "@/server/emails";
import { emitWebhook } from "@/server/webhooks";
import { orderPayload } from "@/server/orders";
import { getTranslator } from "@/lib/i18n";
import { notifyBackInStock } from "@/server/stock-alerts";
import { formatMoney } from "@/lib/money";

export class OrderActionError extends Error {
  constructor(public code: "not_found" | "invalid" | "nothing" | "amount" | "provider" | "state") {
    super(code);
  }
}

async function loadOrder(storeId: string, orderId: string) {
  const order = await db.order.findFirst({ where: { id: orderId, storeId }, include: { lines: true } });
  if (!order) throw new OrderActionError("not_found");
  return order;
}

export async function addOrderEvent(orderId: string, type: string, message: string, author?: string) {
  await db.orderEvent.create({ data: { orderId, type, message: message.slice(0, 2000), author } });
}

/** Create a fulfillment for the given line quantities (defaults to everything unfulfilled). */
export async function fulfillOrder(
  store: Store,
  orderId: string,
  input: { lines?: { lineId: string; quantity: number }[]; trackingCompany?: string; trackingNumber?: string; trackingUrl?: string; notify: boolean; author?: string },
) {
  const order = await loadOrder(store.id, orderId);
  if (order.status === "CANCELLED") throw new OrderActionError("state");
  const selection = (input.lines ?? order.lines.map((l) => ({ lineId: l.id, quantity: l.quantity })))
    .map((s) => {
      const line = order.lines.find((l) => l.id === s.lineId);
      if (!line || !line.requiresShipping) return null;
      const remaining = line.quantity - line.refundedQty - line.fulfilledQty;
      const qty = Math.max(0, Math.min(Math.floor(s.quantity), remaining));
      return qty > 0 ? { line, qty } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  if (!selection.length) throw new OrderActionError("nothing");
  if (input.trackingUrl && !/^https?:\/\//.test(input.trackingUrl)) throw new OrderActionError("invalid");

  const fulfillment = await db.$transaction(async (tx) => {
    const f = await tx.fulfillment.create({
      data: {
        orderId: order.id,
        trackingCompany: input.trackingCompany || null,
        trackingNumber: input.trackingNumber || null,
        trackingUrl: input.trackingUrl || null,
        lines: { create: selection.map((s) => ({ orderLineId: s.line.id, quantity: s.qty })) },
      },
    });
    for (const s of selection) await tx.orderLine.update({ where: { id: s.line.id }, data: { fulfilledQty: { increment: s.qty } } });
    const lines = await tx.orderLine.findMany({ where: { orderId: order.id } });
    await tx.order.update({ where: { id: order.id }, data: { fulfillmentStatus: fulfillmentStatusFor(lines) } });
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "fulfilled",
        author: input.author,
        message: getTranslator(store.locale)("event.fulfilled", { count: selection.reduce((n, s) => n + s.qty, 0) }) + (input.trackingNumber ? ` · ${input.trackingNumber}` : ""),
      },
    });
    return f;
  });
  const fresh = await loadOrder(store.id, order.id);
  if (input.notify) await sendShippingConfirmation(store, fresh, fulfillment);
  if (fresh.fulfillmentStatus === "FULFILLED") await emitWebhook(store.id, "orders/fulfilled", orderPayload(fresh));
  return fulfillment;
}

/** Mark a manual-payment order (COD, bank transfer) as paid. */
export async function markOrderPaid(store: Store, orderId: string, author?: string) {
  const order = await loadOrder(store.id, orderId);
  if (order.financialStatus !== "PENDING" || order.status === "CANCELLED") throw new OrderActionError("state");
  await db.order.update({ where: { id: order.id }, data: { financialStatus: "PAID", events: { create: { type: "paid", message: getTranslator(store.locale)("event.markedPaid"), author } } } });
  await emitWebhook(store.id, "orders/paid", orderPayload(await loadOrder(store.id, order.id)));
}

/**
 * Refund money and/or items. Card payments are refunded through Stripe
 * (reversing the transfer and the platform fee); manual payments are recorded only.
 */
export async function refundOrder(
  store: Store,
  orderId: string,
  input: { lines: { lineId: string; quantity: number }[]; amountCents: number; restock: boolean; reason?: string; notify: boolean; author?: string },
) {
  const order = await loadOrder(store.id, orderId);
  if (order.financialStatus === "PENDING" || order.financialStatus === "VOIDED") {
    if (input.amountCents > 0) throw new OrderActionError("state");
  }
  const remaining = order.totalCents - order.refundedCents;
  const amount = Math.floor(input.amountCents);
  if (amount < 0 || amount > remaining) throw new OrderActionError("amount");
  const selection = input.lines
    .map((s) => {
      const line = order.lines.find((l) => l.id === s.lineId);
      if (!line) return null;
      const qty = Math.max(0, Math.min(Math.floor(s.quantity), line.quantity - line.refundedQty));
      return qty > 0 ? { line, qty } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  if (amount === 0 && selection.length === 0) throw new OrderActionError("nothing");

  let providerRef: string | null = null;
  if (amount > 0 && order.paymentMethod === "stripe" && order.paymentRef) {
    const stripe = getStripe();
    if (!stripe) throw new OrderActionError("provider");
    try {
      const refund = await stripe.refunds.create(
        { payment_intent: order.paymentRef, amount, reverse_transfer: true, refund_application_fee: true, reason: "requested_by_customer", metadata: { orderId: order.id } },
        { idempotencyKey: `refund-${order.id}-${order.refundedCents}-${amount}` },
      );
      providerRef = refund.id;
    } catch (e) {
      console.error("[refund] stripe", e);
      throw new OrderActionError("provider");
    }
  }

  await db.$transaction(async (tx) => {
    await tx.refund.create({
      data: {
        orderId: order.id,
        amountCents: amount,
        reason: input.reason || null,
        restock: input.restock,
        lines: selection.map((s) => ({ orderLineId: s.line.id, quantity: s.qty })),
        providerRef,
      },
    });
    for (const s of selection) {
      await tx.orderLine.update({ where: { id: s.line.id }, data: { refundedQty: { increment: s.qty } } });
      if (input.restock && s.line.variantId) {
        await tx.productVariant.updateMany({
          where: { id: s.line.variantId, trackInventory: true, product: { storeId: store.id } },
          data: { inventoryQty: { increment: s.qty } },
        });
      }
    }
    const refundedCents = order.refundedCents + amount;
    const lines = await tx.orderLine.findMany({ where: { orderId: order.id } });
    await tx.order.update({
      where: { id: order.id },
      data: {
        refundedCents,
        financialStatus: order.financialStatus === "PENDING" ? "PENDING" : financialStatusAfterRefund(order.totalCents, refundedCents),
        fulfillmentStatus: fulfillmentStatusFor(lines),
      },
    });
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "refunded",
        author: input.author,
        message: [
          getTranslator(store.locale)("event.refunded", { amount: formatMoney(amount, order.currency, store.locale) }),
          selection.length ? getTranslator(store.locale)(input.restock ? "event.itemsRestocked" : "event.items", { count: selection.reduce((n, s) => n + s.qty, 0) }) : "",
          input.reason ?? "",
        ].filter(Boolean).join(" · "),
      },
    });
  });
  const fresh = await loadOrder(store.id, order.id);
  if (input.restock) await notifyBackInStock(selection.map((s) => s.line.variantId).filter((v): v is string => !!v));
  if (input.notify && amount > 0) await sendRefundNotification(store, fresh, amount);
  await emitWebhook(store.id, "orders/refunded", orderPayload(fresh));
}

/** Cancel an order: optionally restock everything not yet fulfilled and refund what was paid. */
export async function cancelOrder(store: Store, orderId: string, input: { reason: string; restock: boolean; refund: boolean; notify: boolean; author?: string }) {
  const order = await loadOrder(store.id, orderId);
  if (order.status === "CANCELLED") throw new OrderActionError("state");
  if (order.fulfillmentStatus === "FULFILLED" && order.lines.some((l) => l.requiresShipping)) throw new OrderActionError("state");

  if (input.refund && order.financialStatus !== "PENDING" && order.totalCents - order.refundedCents > 0) {
    await refundOrder(store, order.id, {
      lines: order.lines.map((l) => ({ lineId: l.id, quantity: l.quantity - l.refundedQty - l.fulfilledQty })),
      amountCents: order.totalCents - order.refundedCents,
      restock: input.restock,
      reason: input.reason,
      notify: false,
      author: input.author,
    });
  } else if (input.restock) {
    await db.$transaction(
      order.lines
        .filter((l) => l.variantId && l.quantity - l.refundedQty - l.fulfilledQty > 0)
        .map((l) =>
          db.productVariant.updateMany({
            where: { id: l.variantId!, trackInventory: true, product: { storeId: store.id } },
            data: { inventoryQty: { increment: l.quantity - l.refundedQty - l.fulfilledQty } },
          }),
        ),
    );
  }
  await db.order.update({
    where: { id: order.id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelReason: input.reason,
      financialStatus: order.financialStatus === "PENDING" ? "VOIDED" : undefined,
      events: { create: { type: "cancelled", message: getTranslator(store.locale)("event.cancelled", { reason: getTranslator(store.locale)(`orders.cancel.reason.${input.reason as "other"}`) }), author: input.author } },
    },
  });
  const fresh = await loadOrder(store.id, order.id);
  if (input.restock) await notifyBackInStock(order.lines.map((l) => l.variantId).filter((v): v is string => !!v));
  if (input.notify) await sendOrderCancelled(store, fresh);
  await emitWebhook(store.id, "orders/cancelled", orderPayload(fresh));
}

/** Sync a refund made outside the platform (e.g. in the Stripe dashboard). */
export async function recordExternalRefund(paymentIntentId: string, totalRefundedCents: number) {
  const order = await db.order.findFirst({ where: { paymentRef: paymentIntentId }, include: { store: { select: { locale: true } } } });
  if (!order || totalRefundedCents <= order.refundedCents) return;
  const delta = totalRefundedCents - order.refundedCents;
  await db.$transaction([
    db.refund.create({ data: { orderId: order.id, amountCents: delta, reason: "Refunded in payment provider", providerRef: paymentIntentId } }),
    db.order.update({
      where: { id: order.id },
      data: {
        refundedCents: totalRefundedCents,
        financialStatus: financialStatusAfterRefund(order.totalCents, totalRefundedCents),
        events: { create: { type: "refunded", message: getTranslator(order.store.locale)("event.externalRefund", { amount: formatMoney(delta, order.currency, order.store.locale) }) } },
      },
    }),
  ]);
}
