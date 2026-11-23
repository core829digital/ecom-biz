/**
 * Integration test for the Stripe webhook route against the real database.
 * Signatures are generated offline with Stripe's own helper, so no network or real keys are needed.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: () => {} }));

process.env.STRIPE_SECRET_KEY = "sk_test_offline_dummy";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_account_test";
process.env.STRIPE_CONNECT_WEBHOOK_SECRET = "whsec_connect_test";

const { default: Stripe } = await import("stripe");
const { db } = await import("@/lib/db");
const { POST } = await import("@/app/api/webhooks/stripe/route");

const stripe = new Stripe("sk_test_offline_dummy");
const accountId = `acct_test_${Date.now()}`;
let storeId = "";

function signedRequest(payload: object, secret: string) {
  const body = JSON.stringify(payload);
  const header = stripe.webhooks.generateTestHeaderString({ payload: body, secret });
  return new Request("http://localhost/api/webhooks/stripe", { method: "POST", body, headers: { "stripe-signature": header } });
}

const accountEvent = (id: string, charges: boolean) => ({
  id,
  object: "event",
  type: "account.updated",
  data: { object: { id: accountId, object: "account", charges_enabled: charges, payouts_enabled: charges } },
});

beforeAll(async () => {
  const store = await db.store.create({ data: { slug: `whtest${Date.now()}`.slice(0, 30), name: "Webhook test", email: "wh@example.com", stripeAccountId: accountId } });
  storeId = store.id;
});

afterAll(async () => {
  await db.store.delete({ where: { id: storeId } });
  await db.processedEvent.deleteMany({ where: { id: { startsWith: "evt_test_" } } });
  await db.$disconnect();
});

describe("Stripe webhook", () => {
  it("rejects a forged signature", async () => {
    const res = await POST(signedRequest(accountEvent("evt_test_forged", true), "whsec_attacker"));
    expect(res.status).toBe(400);
  });

  it("accepts Connect events signed with the Connect secret and updates the store", async () => {
    const res = await POST(signedRequest(accountEvent(`evt_test_${Date.now()}a`, true), "whsec_connect_test"));
    expect(res.status).toBe(200);
    const store = await db.store.findUniqueOrThrow({ where: { id: storeId } });
    expect(store.stripeChargesEnabled).toBe(true);
    expect(store.stripePayoutsEnabled).toBe(true);
  });

  it("accepts events signed with the account secret and is idempotent per event id", async () => {
    const id = `evt_test_${Date.now()}b`;
    const first = await POST(signedRequest(accountEvent(id, false), "whsec_account_test"));
    expect(first.status).toBe(200);
    expect((await db.store.findUniqueOrThrow({ where: { id: storeId } })).stripeChargesEnabled).toBe(false);
    // A replay of the same event must not be processed again.
    await db.store.update({ where: { id: storeId }, data: { stripeChargesEnabled: true } });
    const replay = await POST(signedRequest(accountEvent(id, false), "whsec_account_test"));
    expect(await replay.json()).toMatchObject({ duplicate: true });
    expect((await db.store.findUniqueOrThrow({ where: { id: storeId } })).stripeChargesEnabled).toBe(true);
  });
});
