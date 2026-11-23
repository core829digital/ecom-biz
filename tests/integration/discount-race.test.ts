/** Concurrency: a discount limited to N uses can never produce more than N orders. */
import { afterAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: () => {} }));
vi.mock("@/server/emails", () => ({ sendOrderConfirmation: async () => {}, sendMerchantNewOrder: async () => {} }));

const { db } = await import("@/lib/db");
const { completeCheckout, DiscountUnavailableError } = await import("@/server/orders");

const slug = `race${Date.now().toString(36)}`;
let storeId = "";

afterAll(async () => {
  if (storeId) await db.store.delete({ where: { id: storeId } });
  await db.$disconnect();
});

describe("discount usage limit under concurrency", () => {
  it("accepts exactly `usageLimit` orders out of many simultaneous ones", async () => {
    const store = await db.store.create({ data: { slug, name: "Race", email: "race@example.com" } });
    storeId = store.id;
    await db.discount.create({ data: { storeId, code: "LIMIT2", type: "FIXED_AMOUNT", value: 100, usageLimit: 2 } });
    const pricing = { lines: [], subtotalCents: 1000, discountCents: 100, shippingCents: 0, shippingDiscountCents: 0, taxCents: 0, totalCents: 900, taxesIncluded: true, taxRateBps: 0, discountCode: "LIMIT2", requiresShipping: false, shippingRateId: null, shippingTitle: null };
    const address = { firstName: "A", lastName: "B", address1: "x", city: "y", zip: "1", countryCode: "RO" };
    const checkouts = await Promise.all(
      Array.from({ length: 6 }, async (_, i) => {
        const cart = await db.cart.create({ data: { storeId, token: `${slug}-${i}` } });
        return db.checkout.create({ data: { storeId, cartId: cart.id, email: `c${i}@example.com`, shippingAddress: address, pricing, paymentMethod: "cod" } });
      }),
    );
    const results = await Promise.allSettled(checkouts.map((c) => completeCheckout(c.id, { paid: false, enforceStock: true })));
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const refused = results.filter((r) => r.status === "rejected" && r.reason instanceof DiscountUnavailableError).length;
    expect(ok).toBe(2);
    expect(refused).toBe(4);
    expect((await db.discount.findFirstOrThrow({ where: { storeId, code: "LIMIT2" } })).usageCount).toBe(2);
    expect(await db.order.count({ where: { storeId } })).toBe(2);
  });
});
