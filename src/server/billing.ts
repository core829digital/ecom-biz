import "server-only";
import type Stripe from "stripe";
import type { Plan, SubscriptionStatus, User } from "@prisma/client";
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

/** Hosted Stripe Checkout for subscribing an account to a plan. Returns the redirect URL. */
export async function createSubscriptionCheckout(user: User, plan: Plan, returnPath = "/account/billing"): Promise<string> {
  const back = `${env.appUrl}${returnPath}`;
  if (plan.priceCents === 0) {
    await db.user.update({ where: { id: user.id }, data: { planId: plan.id, subscriptionStatus: "ACTIVE" } });
    return `${back}?updated=1`;
  }
  const stripe = getStripe();
  if (!stripe) throw new BillingError("Stripe is not configured");
  const price = await ensurePlanPrice(plan);
  const trialEnd = user.subscriptionStatus === "TRIALING" && user.trialEndsAt && user.trialEndsAt.getTime() > Date.now() + 48 * 3600_000
    ? Math.floor(user.trialEndsAt.getTime() / 1000)
    : undefined;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    ...(user.stripeCustomerId ? { customer: user.stripeCustomerId } : { customer_email: user.email }),
    client_reference_id: user.id,
    metadata: { userId: user.id, planId: plan.id },
    subscription_data: { metadata: { userId: user.id, planId: plan.id }, ...(trialEnd ? { trial_end: trialEnd } : {}) },
    allow_promotion_codes: true,
    success_url: `${back}?updated=1`,
    cancel_url: back,
  });
  if (!session.url) throw new BillingError("No checkout URL");
  return session.url;
}

export async function createBillingPortal(user: User, returnPath = "/account/billing"): Promise<string> {
  const stripe = getStripe();
  if (!stripe || !user.stripeCustomerId) throw new BillingError("No billing account");
  const portal = await stripe.billingPortal.sessions.create({ customer: user.stripeCustomerId, return_url: `${env.appUrl}${returnPath}` });
  return portal.url;
}

async function syncSubscription(sub: Stripe.Subscription) {
  const userId = sub.metadata?.userId;
  const priceId = sub.items.data[0]?.price.id;
  const plan = priceId ? await db.plan.findFirst({ where: { stripePriceId: priceId } }) : null;
  await db.user.updateMany({
    where: userId ? { id: userId } : { stripeSubscriptionId: sub.id },
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
      if (customer) await db.user.updateMany({ where: { stripeCustomerId: customer }, data: { subscriptionStatus: "PAST_DUE" } });
      break;
    }
  }
}
