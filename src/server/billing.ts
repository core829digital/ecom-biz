import "server-only";
import type Stripe from "stripe";
import type { Plan, User } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { mapStripeStatus } from "@/lib/billing-rules";
import { claimHash, networkOf, cardUsedForTrial, recordTrialClaims, trialEligibility } from "@/server/trial";
import { audit } from "@/server/audit";
import { sendBillingEmail } from "@/server/billing-emails";
import { notifyStore, notifyUsers } from "@/server/notifications";

export type BillingErrorCode = "not_configured" | "verify_email" | "hold" | "no_account" | "no_url";
export class BillingError extends Error {
  constructor(public code: BillingErrorCode) {
    super(code);
  }
}

/** Subscription statuses that still hold (or will hold) the account's plan. */
const LIVE = new Set(["trialing", "active", "past_due", "unpaid", "incomplete"]);

/** Create the Stripe Product + Price for a plan if it does not have one yet. */
export async function ensurePlanPrice(plan: Plan): Promise<string> {
  if (plan.stripePriceId) return plan.stripePriceId;
  const stripe = getStripe();
  if (!stripe) throw new BillingError("not_configured");
  const price = await stripe.prices.create(
    {
      currency: plan.currency.toLowerCase(),
      unit_amount: plan.priceCents,
      recurring: { interval: plan.interval === "year" ? "year" : "month" },
      product_data: { name: `${env.platformName} ${plan.name}` },
      metadata: { planId: plan.id },
    },
    { idempotencyKey: `plan-price-${plan.id}-${plan.priceCents}-${plan.currency}-${plan.interval}` },
  );
  await db.plan.update({ where: { id: plan.id }, data: { stripePriceId: price.id } });
  return price.id;
}

/**
 * Hosted Stripe Checkout for subscribing an account to a plan. A card is always collected,
 * including for free trials, and the trial is only offered to accounts that never had one
 * (see trial.ts). Returns the redirect URL.
 */
export async function createSubscriptionCheckout(user: User, plan: Plan, opts: { ip: string; returnPath?: string }): Promise<{ url: string; trialDays: number; denied?: string }> {
  const back = `${env.appUrl}${opts.returnPath ?? "/account/billing"}`;
  if (user.billingHold) throw new BillingError("hold");
  if (!user.emailVerifiedAt) throw new BillingError("verify_email");
  if (plan.priceCents === 0) {
    await db.user.update({ where: { id: user.id }, data: { planId: plan.id, subscriptionStatus: "ACTIVE", pastDueSince: null } });
    return { url: `${back}?updated=1`, trialDays: 0 };
  }
  const stripe = getStripe();
  if (!stripe) throw new BillingError("not_configured");
  const price = await ensurePlanPrice(plan);
  const decision = await trialEligibility(user, plan.trialDays, opts.ip);
  const network = networkOf(opts.ip);
  const metadata = {
    userId: user.id,
    planId: plan.id,
    trial: decision.trialDays > 0 ? "1" : "0",
    // Hash only: the raw IP never leaves our servers.
    ...(network ? { net: claimHash("NETWORK", network) } : {}),
  };
  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      ...(user.stripeCustomerId ? { customer: user.stripeCustomerId } : { customer_email: user.email }),
      client_reference_id: user.id,
      payment_method_collection: "always",
      metadata,
      subscription_data: {
        metadata,
        ...(decision.trialDays > 0
          ? { trial_period_days: decision.trialDays, trial_settings: { end_behavior: { missing_payment_method: "cancel" } } }
          : {}),
      },
      allow_promotion_codes: true,
      success_url: `${back}?updated=1`,
      cancel_url: back,
    },
    // Double clicks within the same minute reuse the same session.
    { idempotencyKey: `sub-checkout-${user.id}-${plan.id}-${decision.trialDays}-${Math.floor(Date.now() / 60_000)}` },
  );
  if (!session.url) throw new BillingError("no_url");
  return { url: session.url, trialDays: decision.trialDays, denied: decision.denied };
}

export async function createBillingPortal(user: User, returnPath = "/account/billing"): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new BillingError("not_configured");
  if (!user.stripeCustomerId) throw new BillingError("no_account");
  const portal = await stripe.billingPortal.sessions.create({ customer: user.stripeCustomerId, return_url: `${env.appUrl}${returnPath}` });
  return portal.url;
}

const idOf = (v: string | { id: string } | null | undefined) => (v ? (typeof v === "string" ? v : v.id) : null);

async function findUserFor(sub: Stripe.Subscription) {
  const userId = sub.metadata?.userId;
  if (userId) {
    const u = await db.user.findUnique({ where: { id: userId } });
    if (u) return u;
  }
  return db.user.findFirst({ where: { OR: [{ stripeSubscriptionId: sub.id }, { stripeCustomerId: idOf(sub.customer) ?? "-" }] } });
}

/** A second live subscription for the same account (e.g. two checkout tabs): cancel and refund it. */
async function cancelDuplicate(stripe: Stripe, sub: Stripe.Subscription, user: User) {
  await stripe.subscriptions.cancel(sub.id, { invoice_now: false, prorate: false });
  const invoices = await stripe.invoices.list({ subscription: sub.id, status: "paid", limit: 5 });
  for (const inv of invoices.data) {
    const payments = await stripe.invoicePayments.list({ invoice: inv.id!, limit: 5 });
    for (const p of payments.data) {
      const pi = p.payment.type === "payment_intent" ? idOf(p.payment.payment_intent) : null;
      const charge = p.payment.type === "charge" ? idOf(p.payment.charge) : null;
      if (pi) await stripe.refunds.create({ payment_intent: pi, reason: "duplicate" }, { idempotencyKey: `dup-refund-${pi}` });
      else if (charge) await stripe.refunds.create({ charge, reason: "duplicate" }, { idempotencyKey: `dup-refund-${charge}` });
    }
  }
  await audit({ userId: user.id, action: "billing.duplicate_subscription_cancelled", target: sub.id });
}

/**
 * Bring our copy of an account's subscription in line with Stripe. Always re-reads the
 * subscription from Stripe, so events arriving late or out of order can't regress state.
 */
export async function syncSubscription(subscriptionId: string) {
  const stripe = getStripe();
  if (!stripe) return;
  let sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["default_payment_method"] });
  const user = await findUserFor(sub);
  if (!user) {
    console.error("[billing] subscription without account", sub.id);
    return;
  }

  // 1. Only one live subscription per account.
  if (user.stripeSubscriptionId && user.stripeSubscriptionId !== sub.id) {
    const current = await stripe.subscriptions.retrieve(user.stripeSubscriptionId).catch(() => null);
    const currentLive = !!current && LIVE.has(current.status);
    if (!LIVE.has(sub.status)) return; // stale event about an old subscription: ignore
    if (currentLive) {
      await cancelDuplicate(stripe, sub, user);
      return;
    }
  }

  // 2. Free-trial protections.
  if (sub.status === "trialing") {
    if (sub.cancel_at_period_end || sub.cancel_at) {
      // Cancelling during the trial ends it now; the trial is never granted again.
      sub = await stripe.subscriptions.cancel(sub.id, { prorate: false }, { idempotencyKey: `trial-cancel-${sub.id}` });
      await audit({ userId: user.id, action: "billing.trial_cancelled", target: sub.id });
    } else {
      const pm = sub.default_payment_method && typeof sub.default_payment_method !== "string" ? sub.default_payment_method : null;
      const fingerprint = pm?.card?.fingerprint ?? null;
      const trialStart = (sub.trial_start ?? sub.created) * 1000;
      const reusedAccountTrial = !!user.trialUsedAt && user.trialUsedAt.getTime() < trialStart - 5 * 60_000;
      const reusedCard = !!fingerprint && (await cardUsedForTrial(fingerprint, user.id));
      if (reusedAccountTrial || reusedCard) {
        // Charge now: Stripe invoices the first period immediately.
        sub = await stripe.subscriptions.update(sub.id, { trial_end: "now", proration_behavior: "none" }, { idempotencyKey: `trial-revoke-${sub.id}` });
        await audit({ userId: user.id, action: "billing.trial_revoked", target: sub.id, meta: { reason: reusedCard ? "card_used" : "already_used" } });
      } else {
        await recordTrialClaims(user.id, { email: user.email, cardFingerprint: fingerprint });
        const net = sub.metadata?.net;
        if (net && /^[a-f0-9]{64}$/.test(net)) {
          const has = await db.trialClaim.findFirst({ where: { userId: user.id, kind: "NETWORK", valueHash: net } });
          if (!has) await db.trialClaim.create({ data: { userId: user.id, kind: "NETWORK", valueHash: net } });
        }
      }
    }
  }

  // 3. Mirror the state.
  const status = mapStripeStatus(sub.status);
  const priceId = sub.items.data[0]?.price.id;
  const periodEnd = sub.items.data[0]?.current_period_end;
  const plan = priceId ? await db.plan.findFirst({ where: { stripePriceId: priceId } }) : null;
  await db.user.update({
    where: { id: user.id },
    data: {
      stripeSubscriptionId: sub.id,
      stripeCustomerId: idOf(sub.customer),
      subscriptionStatus: status,
      ...(plan ? { planId: plan.id } : {}),
      trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : status === "TRIALING" ? user.trialEndsAt : null,
      ...(sub.trial_start && !user.trialUsedAt ? { trialUsedAt: new Date(sub.trial_start * 1000) } : {}),
      cancelAtPeriodEnd: !!(sub.cancel_at_period_end || sub.cancel_at) && status !== "CANCELED",
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
      pastDueSince: status === "PAST_DUE" ? (user.pastDueSince ?? new Date()) : null,
    },
  });
}

/** Platform-account disputes: on a merchant order (card sale) or on a subscription invoice. */
async function handleDispute(stripe: Stripe, dispute: Stripe.Dispute, created: boolean) {
  const pi = idOf(dispute.payment_intent);
  const order = pi ? await db.order.findFirst({ where: { paymentRef: pi }, select: { id: true, storeId: true, number: true, store: { select: { slug: true } } } }) : null;
  if (order) {
    await db.orderEvent.create({ data: { orderId: order.id, type: "dispute", message: `Payment dispute ${created ? "opened" : `closed (${dispute.status})`}: ${dispute.reason}` } });
    await audit({ storeId: order.storeId, action: created ? "order.dispute_opened" : "order.dispute_closed", target: order.id, meta: { dispute: dispute.id, status: dispute.status } });
    if (created) await notifyStore(order.storeId, { type: "order_dispute", data: { number: order.number, reason: dispute.reason }, href: `/admin/${order.store.slug}/orders/${order.id}` }, ["OWNER", "ADMIN"]);
    return;
  }
  const charge = await stripe.charges.retrieve(idOf(dispute.charge)!);
  const customer = idOf(charge.customer);
  const user = customer ? await db.user.findUnique({ where: { stripeCustomerId: customer } }) : null;
  if (!user) return;
  if (created) {
    // A chargeback on our own invoice: pause the account until a platform admin reviews it.
    await db.user.update({ where: { id: user.id }, data: { billingHold: true, billingHoldReason: `dispute:${dispute.id}` } });
    await audit({ userId: user.id, action: "billing.hold_dispute", target: dispute.id });
    await notifyUsers([user.id], { type: "billing_hold", href: "/account/billing" });
  } else if (dispute.status === "won" && user.billingHoldReason === `dispute:${dispute.id}`) {
    await db.user.update({ where: { id: user.id }, data: { billingHold: false, billingHoldReason: null } });
    await audit({ userId: user.id, action: "billing.hold_cleared", target: dispute.id });
  }
}

function invoiceSubscriptionId(invoice: Stripe.Invoice) {
  return idOf(invoice.parent?.subscription_details?.subscription ?? null);
}

/** Billing-related Stripe events (platform account). */
export async function handleBillingEvent(event: Stripe.Event) {
  const stripe = getStripe();
  if (!stripe) return;
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode !== "subscription" || !session.subscription) return;
      await syncSubscription(idOf(session.subscription)!);
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      await syncSubscription(event.data.object.id);
      break;
    case "customer.subscription.trial_will_end": {
      // Three days before the first charge: remind the merchant (transparency, fewer disputes).
      const sub = event.data.object;
      const user = await findUserFor(sub);
      if (user && !sub.cancel_at_period_end) {
        const date = sub.trial_end ? new Date(sub.trial_end * 1000) : null;
        await sendBillingEmail(user, "trial_ending", { date });
        await notifyUsers([user.id], { type: "billing_trial_ending", data: { date: date ? date.toISOString().slice(0, 10) : "" }, href: "/account/billing" });
      }
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const subId = invoiceSubscriptionId(invoice);
      if (subId) await syncSubscription(subId);
      const customer = idOf(invoice.customer);
      const user = customer ? await db.user.findUnique({ where: { stripeCustomerId: customer } }) : null;
      if (user) {
        await sendBillingEmail(user, "payment_failed", { date: user.pastDueSince });
        await notifyUsers([user.id], { type: "billing_payment_failed", href: "/account/billing" });
      }
      break;
    }
    case "invoice.paid": {
      const subId = invoiceSubscriptionId(event.data.object);
      if (subId) await syncSubscription(subId);
      break;
    }
    case "charge.dispute.created":
      await handleDispute(stripe, event.data.object, true);
      break;
    case "charge.dispute.closed":
      await handleDispute(stripe, event.data.object, false);
      break;
  }
}
