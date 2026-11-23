import "server-only";
import type Stripe from "stripe";
import type { Plan, Store, SubscriptionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/stripe";

export class BillingError extends Error {}

function mapStatus(s: Stripe.Subscription.Status): SubscriptionStatus {
  switch (s) {
    case "trialing":
      return "TRIALING";
    case "active":
      return "ACTIVE";
    case "past_due":
    case "unpaid":
    case "incomplete":
      return "PAST_DUE";
    default:
      return "CANCELED";
  }
}

/** Create the Stripe Product + Price for a plan if it does not have one yet. */
export async function ensurePlanPrice(plan: Plan): Promise<string> {
  if (plan.stripePriceId) return plan.stripePriceId;
  const stripe = getStripe();
  if (!stripe) throw new BillingError("Stripe is not configured");
  const price = await stripe.prices.create({
    currency: plan.currency.toLowerCase(),
    unit_amount: plan.priceCents,
    recurring: { interval: plan.interval === "year" ? "year" : "month" },
    product_data: { name: `${env.platformName} ${plan.name}` },
    metadata: { planId: plan.id },
  });
  await db.plan.update({ where: { id: plan.id }, data: { stripePriceId: price.id } });
  return price.id;
}

/** Hosted Stripe Checkout for subscribing a store to a plan. Returns the redirect URL. */
export async function createSubscriptionCheckout(store: Store, plan: Plan, ownerEmail: string): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new BillingError("Stripe is not configured");
  if (plan.priceCents === 0) {
    await db.store.update({ where: { id: store.id }, data: { planId: plan.id, subscriptionStatus: "ACTIVE" } });
    return `${env.appUrl}/admin/${store.slug}/settings/billing?updated=1`;
  }
  const price = await ensurePlanPrice(plan);
  const trialEnd = store.subscriptionStatus === "TRIALING" && store.trialEndsAt && store.trialEndsAt.getTime() > Date.now() + 48 * 3600_000
    ? Math.floor(store.trialEndsAt.getTime() / 1000)
    : undefined;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    ...(store.stripeCustomerId ? { customer: store.stripeCustomerId } : { customer_email: ownerEmail }),
    client_reference_id: store.id,
    metadata: { storeId: store.id, planId: plan.id },
    subscription_data: { metadata: { storeId: store.id, planId: plan.id }, ...(trialEnd ? { trial_end: trialEnd } : {}) },
    success_url: `${env.appUrl}/admin/${store.slug}/settings/billing?updated=1`,
    cancel_url: `${env.appUrl}/admin/${store.slug}/settings/billing`,
  });
  if (!session.url) throw new BillingError("No checkout URL");
  return session.url;
}

export async function createBillingPortal(store: Store): Promise<string> {
  const stripe = getStripe();
  if (!stripe || !store.stripeCustomerId) throw new BillingError("No billing account");
  const portal = await stripe.billingPortal.sessions.create({
    customer: store.stripeCustomerId,
    return_url: `${env.appUrl}/admin/${store.slug}/settings/billing`,
  });
  return portal.url;
}

async function syncSubscription(sub: Stripe.Subscription) {
  const storeId = sub.metadata?.storeId;
  const priceId = sub.items.data[0]?.price.id;
  const plan = priceId ? await db.plan.findFirst({ where: { stripePriceId: priceId } }) : null;
  const where = storeId ? { id: storeId } : { stripeSubscriptionId: sub.id };
  await db.store.updateMany({
    where,
    data: {
      stripeSubscriptionId: sub.id,
      stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      subscriptionStatus: mapStatus(sub.status),
      ...(plan ? { planId: plan.id } : {}),
      ...(sub.trial_end ? { trialEndsAt: new Date(sub.trial_end * 1000) } : {}),
    },
  });
}

/** Billing-related Stripe events (platform account). */
export async function handleBillingEvent(event: Stripe.Event) {
  const stripe = getStripe();
  if (!stripe) return;
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode !== "subscription" || !session.subscription) return;
      const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
      await syncSubscription(await stripe.subscriptions.retrieve(subId));
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(event.data.object);
      break;
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const customer = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (customer) await db.store.updateMany({ where: { stripeCustomerId: customer }, data: { subscriptionStatus: "PAST_DUE" } });
      break;
    }
  }
}
