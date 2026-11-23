/**
 * Subscription lifecycle and free-trial abuse protections, against the real database with an
 * in-memory Stripe double (no network, no keys). Each test is one real-world case.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
process.env.APP_SECRET ??= "test-secret-test-secret-test-secret-0123";

type Sub = {
  id: string; object: "subscription"; status: string; customer: string; created: number;
  metadata: Record<string, string>; cancel_at_period_end: boolean; cancel_at: number | null;
  trial_start: number | null; trial_end: number | null;
  default_payment_method: { id: string; card: { fingerprint: string } } | null;
  items: { data: { price: { id: string }; current_period_end: number }[] };
};

const h = vi.hoisted(() => {
  const subs = new Map<string, Sub>();
  const calls = { cancel: [] as string[], update: [] as [string, unknown][], refunds: [] as unknown[], emails: [] as [string, string][] };
  const chargeCustomer = new Map<string, string>();
  const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
  const fake = {
    subscriptions: {
      retrieve: async (id: string) => {
        const s = subs.get(id);
        if (!s) throw new Error(`no such subscription ${id}`);
        return clone(s);
      },
      cancel: async (id: string) => {
        const s = subs.get(id)!;
        s.status = "canceled";
        s.cancel_at_period_end = false;
        calls.cancel.push(id);
        return clone(s);
      },
      update: async (id: string, p: { trial_end?: string }) => {
        const s = subs.get(id)!;
        if (p.trial_end === "now") {
          s.status = "active";
          s.trial_end = Math.floor(Date.now() / 1000);
        }
        calls.update.push([id, p]);
        return clone(s);
      },
    },
    invoices: { list: async ({ subscription }: { subscription: string }) => ({ data: subscription.startsWith("sub_dup") ? [{ id: "in_dup" }] : [] }) },
    invoicePayments: { list: async () => ({ data: [{ payment: { type: "payment_intent", payment_intent: "pi_dup" } }] }) },
    refunds: { create: async (p: unknown) => (calls.refunds.push(p), {}) },
    charges: { retrieve: async (id: string) => ({ id, customer: chargeCustomer.get(id) ?? null }) },
  };
  return { subs, calls, chargeCustomer, fake };
});

vi.mock("@/lib/stripe", () => ({ getStripe: () => h.fake }));
vi.mock("@/server/billing-emails", () => ({ sendBillingEmail: async (u: { email: string }, kind: string) => void h.calls.emails.push([u.email, kind]) }));

const { db } = await import("@/lib/db");
const { syncSubscription, handleBillingEvent } = await import("@/server/billing");
const { trialEligibility, recordTrialClaims } = await import("@/server/trial");
const { accountActive } = await import("@/server/plans");

const run = Date.now().toString(36);
const priceId = `price_test_${run}`;
const now = () => Math.floor(Date.now() / 1000);
const userIds: string[] = [];
let planId = "";

async function makeUser(email: string, extra: Record<string, unknown> = {}) {
  const u = await db.user.create({ data: { email, name: "Test", passwordHash: "x", emailVerifiedAt: new Date(), subscriptionStatus: "NONE", ...extra } });
  userIds.push(u.id);
  return u;
}

function makeSub(id: string, o: { userId: string; customer: string; status: string; fp?: string; trial?: boolean; cancelAtPeriodEnd?: boolean; net?: string }): Sub {
  const s: Sub = {
    id, object: "subscription", status: o.status, customer: o.customer, created: now(),
    metadata: { userId: o.userId, ...(o.net ? { net: o.net } : {}) },
    cancel_at_period_end: !!o.cancelAtPeriodEnd, cancel_at: null,
    trial_start: o.trial ? now() : null, trial_end: o.trial ? now() + 14 * 86400 : null,
    default_payment_method: o.fp ? { id: "pm_x", card: { fingerprint: o.fp } } : null,
    items: { data: [{ price: { id: priceId }, current_period_end: now() + 30 * 86400 }] },
  };
  h.subs.set(id, s);
  return s;
}

const event = (type: string, object: object) => ({ id: `evt_${Math.random()}`, object: "event", type, data: { object } }) as never;

beforeAll(async () => {
  const plan = await db.plan.create({ data: { name: `Test ${run}`, priceCents: 1900, currency: "EUR", trialDays: 14, stripePriceId: priceId, active: false, position: 99 } });
  planId = plan.id;
});

afterAll(async () => {
  await db.trialClaim.deleteMany({ where: { userId: { in: userIds } } });
  await db.auditLog.deleteMany({ where: { userId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.plan.delete({ where: { id: planId } });
  await db.$disconnect();
});

describe("free trial", () => {
  it("starts a card-backed trial and records who used it", async () => {
    const u = await makeUser(`alice.${run}@gmail.com`);
    makeSub(`sub_a_${run}`, { userId: u.id, customer: `cus_a_${run}`, status: "trialing", fp: `fp_a_${run}`, trial: true });
    await syncSubscription(`sub_a_${run}`);
    const after = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(after.subscriptionStatus).toBe("TRIALING");
    expect(after.planId).toBe(planId);
    expect(after.trialUsedAt).not.toBeNull();
    expect(after.currentPeriodEnd).not.toBeNull();
    const kinds = (await db.trialClaim.findMany({ where: { userId: u.id } })).map((c) => c.kind).sort();
    expect(kinds).toEqual(["CARD", "EMAIL"]);
  });

  it("cancelling during the trial ends it immediately, and no new trial is offered", async () => {
    const u = await makeUser(`bob.${run}@example.com`);
    makeSub(`sub_b_${run}`, { userId: u.id, customer: `cus_b_${run}`, status: "trialing", fp: `fp_b_${run}`, trial: true });
    await syncSubscription(`sub_b_${run}`);
    // The merchant cancels in the billing portal (Stripe sets cancel_at_period_end).
    h.subs.get(`sub_b_${run}`)!.cancel_at_period_end = true;
    await handleBillingEvent(event("customer.subscription.updated", h.subs.get(`sub_b_${run}`)!));
    expect(h.calls.cancel).toContain(`sub_b_${run}`);
    const after = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(after.subscriptionStatus).toBe("CANCELED");
    expect(accountActive(after)).toBe(false);
    expect((await trialEligibility(after, 14, "203.0.113.9")).denied).toBe("already_used");
  });

  it("the same card on a new account gets no trial: it is charged immediately", async () => {
    const u = await makeUser(`carol.${run}@example.com`);
    makeSub(`sub_c_${run}`, { userId: u.id, customer: `cus_c_${run}`, status: "trialing", fp: `fp_a_${run}`, trial: true });
    await syncSubscription(`sub_c_${run}`);
    expect(h.calls.update).toContainEqual([`sub_c_${run}`, { trial_end: "now", proration_behavior: "none" }]);
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).subscriptionStatus).toBe("ACTIVE");
  });

  it("email tricks don't create a new trial (dots and +tags on Gmail)", async () => {
    const u = await makeUser(`a.l.i.c.e.${run}+promo@googlemail.com`);
    expect((await trialEligibility(u, 14, "198.51.100.1")).denied).toBe("email_used");
  });

  it("disposable inboxes get no trial", async () => {
    const u = await makeUser(`dave.${run}@mailinator.com`);
    expect((await trialEligibility(u, 14, "198.51.100.2")).denied).toBe("disposable_email");
  });

  it("many trials from the same network are refused", async () => {
    for (let i = 0; i < 3; i++) {
      const u = await makeUser(`net${i}.${run}@example.com`);
      await recordTrialClaims(u.id, { ip: "192.0.2.10" });
    }
    const next = await makeUser(`net9.${run}@example.com`);
    // Another address in the same /24 network.
    expect((await trialEligibility(next, 14, "192.0.2.200")).denied).toBe("network_limit");
    expect((await trialEligibility(next, 14, "192.0.3.200")).trialDays).toBe(14);
  });
});

describe("subscription integrity", () => {
  it("a second live subscription (two checkout tabs) is cancelled and refunded", async () => {
    const u = await makeUser(`erin.${run}@example.com`);
    makeSub(`sub_e1_${run}`, { userId: u.id, customer: `cus_e_${run}`, status: "active" });
    await syncSubscription(`sub_e1_${run}`);
    makeSub(`sub_dup_${run}`, { userId: u.id, customer: `cus_e_${run}`, status: "active" });
    await syncSubscription(`sub_dup_${run}`);
    expect(h.calls.cancel).toContain(`sub_dup_${run}`);
    expect(h.calls.refunds).toContainEqual({ payment_intent: "pi_dup", reason: "duplicate" });
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).stripeSubscriptionId).toBe(`sub_e1_${run}`);
  });

  it("a late event about an old, cancelled subscription doesn't overwrite the current one", async () => {
    const u = await makeUser(`fred.${run}@example.com`);
    makeSub(`sub_f_old_${run}`, { userId: u.id, customer: `cus_f_${run}`, status: "canceled" });
    makeSub(`sub_f_new_${run}`, { userId: u.id, customer: `cus_f_${run}`, status: "active" });
    await syncSubscription(`sub_f_new_${run}`);
    await handleBillingEvent(event("customer.subscription.deleted", h.subs.get(`sub_f_old_${run}`)!));
    const after = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(after.subscriptionStatus).toBe("ACTIVE");
    expect(after.stripeSubscriptionId).toBe(`sub_f_new_${run}`);
  });

  it("a failed renewal keeps the stores open for the grace period, then pauses them", async () => {
    const u = await makeUser(`gina.${run}@example.com`);
    makeSub(`sub_g_${run}`, { userId: u.id, customer: `cus_g_${run}`, status: "active" });
    await syncSubscription(`sub_g_${run}`);
    h.subs.get(`sub_g_${run}`)!.status = "past_due";
    await handleBillingEvent(event("invoice.payment_failed", { id: "in_g", object: "invoice", customer: `cus_g_${run}`, parent: { subscription_details: { subscription: `sub_g_${run}` } } }));
    const pd = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(pd.subscriptionStatus).toBe("PAST_DUE");
    expect(pd.pastDueSince).not.toBeNull();
    expect(accountActive(pd)).toBe(true);
    expect(accountActive(pd, new Date(Date.now() + 8 * 86400_000))).toBe(false);
    expect(h.calls.emails).toContainEqual([`gina.${run}@example.com`, "payment_failed"]);
    // Card updated, invoice paid: back to normal.
    h.subs.get(`sub_g_${run}`)!.status = "active";
    await handleBillingEvent(event("invoice.paid", { id: "in_g", object: "invoice", customer: `cus_g_${run}`, parent: { subscription_details: { subscription: `sub_g_${run}` } } }));
    const ok = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(ok.subscriptionStatus).toBe("ACTIVE");
    expect(ok.pastDueSince).toBeNull();
  });

  it("a chargeback on our invoice puts the account on hold until the dispute is won", async () => {
    const u = await makeUser(`hank.${run}@example.com`, { stripeCustomerId: `cus_h_${run}`, subscriptionStatus: "ACTIVE" });
    h.chargeCustomer.set(`ch_h_${run}`, `cus_h_${run}`);
    const dispute = { id: `dp_h_${run}`, object: "dispute", charge: `ch_h_${run}`, payment_intent: `pi_h_${run}`, status: "needs_response", reason: "fraudulent" };
    await handleBillingEvent(event("charge.dispute.created", dispute));
    const held = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(held.billingHold).toBe(true);
    expect(accountActive(held)).toBe(false);
    await handleBillingEvent(event("charge.dispute.closed", { ...dispute, status: "won" }));
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).billingHold).toBe(false);
  });

  it("reminds the merchant before the trial converts", async () => {
    const u = await makeUser(`ivy.${run}@example.com`);
    const s = makeSub(`sub_i_${run}`, { userId: u.id, customer: `cus_i_${run}`, status: "trialing", fp: `fp_i_${run}`, trial: true });
    await handleBillingEvent(event("customer.subscription.trial_will_end", s));
    expect(h.calls.emails).toContainEqual([`ivy.${run}@example.com`, "trial_ending"]);
  });
});

describe("webhook endpoint routing", () => {
  it("delivers billing events through the signed endpoint, and ignores forged ones", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_lifecycle_test";
    const { default: Stripe } = await import("stripe");
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const signer = new Stripe("sk_test_offline_dummy");
    // The double verifies signatures with Stripe's real implementation.
    (h.fake as unknown as { webhooks: typeof signer.webhooks }).webhooks = signer.webhooks;
    const u = await makeUser(`jack.${run}@example.com`, { stripeCustomerId: `cus_j_${run}`, subscriptionStatus: "ACTIVE" });
    h.chargeCustomer.set(`ch_j_${run}`, `cus_j_${run}`);
    const payload = { id: `evt_life_${run}`, object: "event", type: "charge.dispute.created", data: { object: { id: `dp_j_${run}`, object: "dispute", charge: `ch_j_${run}`, payment_intent: null, status: "needs_response", reason: "fraudulent" } } };
    const send = (secret: string) => {
      const body = JSON.stringify(payload);
      return POST(new Request("http://localhost/api/webhooks/stripe", { method: "POST", body, headers: { "stripe-signature": signer.webhooks.generateTestHeaderString({ payload: body, secret }) } }));
    };
    expect((await send("whsec_attacker")).status).toBe(400);
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).billingHold).toBe(false);
    expect((await send("whsec_lifecycle_test")).status).toBe(200);
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).billingHold).toBe(true);
    await db.processedEvent.deleteMany({ where: { id: `evt_life_${run}` } });
  });
});
