import type Stripe from "stripe";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { completeCheckout } from "@/server/orders";
import { handleBillingEvent } from "@/server/billing";
import { recordExternalRefund } from "@/server/order-admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe || !env.stripeWebhookSecret) return new Response("Stripe not configured", { status: 503 });
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature ?? "", env.stripeWebhookSecret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  // Idempotency: Stripe may deliver the same event more than once.
  const seen = await db.processedEvent.findUnique({ where: { id: event.id } });
  if (seen) return Response.json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object;
        const checkoutId = pi.metadata?.checkoutId;
        if (checkoutId) {
          const checkout = await db.checkout.findUnique({ where: { id: checkoutId } });
          if (checkout && checkout.paymentRef === pi.id && pi.amount_received === (checkout.pricing as { totalCents: number }).totalCents) {
            await completeCheckout(checkout.id, { paid: true, enforceStock: false });
          } else if (checkout) {
            console.error("[stripe] amount/ref mismatch", { checkoutId, pi: pi.id });
          }
        }
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object;
        console.warn("[stripe] payment failed", pi.id, pi.last_payment_error?.message);
        break;
      }
      case "account.updated": {
        const account = event.data.object;
        await db.store.updateMany({
          where: { stripeAccountId: account.id },
          data: { stripeChargesEnabled: account.charges_enabled, stripePayoutsEnabled: account.payouts_enabled },
        });
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object;
        const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
        if (piId) await recordExternalRefund(piId, charge.amount_refunded);
        break;
      }
      case "checkout.session.completed":
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "invoice.payment_failed":
        await handleBillingEvent(event);
        break;
    }
  } catch (e) {
    console.error("[stripe] webhook handler failed", event.type, e);
    return new Response("Handler error", { status: 500 }); // Stripe will retry
  }
  await db.processedEvent.create({ data: { id: event.id } }).catch(() => undefined);
  return Response.json({ received: true });
}
