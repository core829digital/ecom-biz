/** GDPR rights and retention against the real database. */
import { afterAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/stripe", () => ({ getStripe: () => null }));
process.env.APP_SECRET ??= "test-secret-test-secret-test-secret-0123";

const { db } = await import("@/lib/db");
const { exportUserData, deleteUserAccount, AccountDeletionError, exportCustomerData, eraseCustomer } = await import("@/server/gdpr");
const { applyRetention } = await import("@/server/retention");
const { claimHash } = await import("@/server/trial");
const { normalizeEmail } = await import("@/lib/billing-rules");

const run = Date.now().toString(36);
const cleanup: (() => Promise<unknown>)[] = [];
afterAll(async () => {
  for (const f of cleanup.reverse()) await f().catch(() => {});
  await db.$disconnect();
});

describe("merchant data", () => {
  it("export contains the account but never secrets", async () => {
    const u = await db.user.create({ data: { email: `exp.${run}@example.com`, name: "Exp", passwordHash: "$2b$12$secret", totpSecret: "sealed-seed", recoveryCodes: ["hash1"] } });
    cleanup.push(() => db.user.delete({ where: { id: u.id } }));
    const data = await exportUserData(u.id);
    const json = JSON.stringify(data);
    expect(data.account.email).toBe(u.email);
    expect(json).not.toContain("$2b$12$secret");
    expect(json).not.toContain("sealed-seed");
    expect(json).not.toContain("hash1");
  });

  it("deletion requires confirming owned stores, deletes them, and keeps the trial record", async () => {
    const u = await db.user.create({ data: { email: `del.${run}@example.com`, name: "Del", passwordHash: "x", trialUsedAt: new Date() } });
    const store = await db.store.create({ data: { slug: `del${run}`.slice(0, 30), name: "Del store", email: "s@example.com", memberships: { create: { userId: u.id, role: "OWNER" } } } });
    await expect(deleteUserAccount(u.id, { deleteOwnedStores: false })).rejects.toBeInstanceOf(AccountDeletionError);
    const res = await deleteUserAccount(u.id, { deleteOwnedStores: true });
    expect(res.deletedStores).toBe(1);
    expect(await db.user.findUnique({ where: { id: u.id } })).toBeNull();
    expect(await db.store.findUnique({ where: { id: store.id } })).toBeNull();
    const claim = await db.trialClaim.findFirst({ where: { kind: "EMAIL", valueHash: claimHash("EMAIL", normalizeEmail(u.email)) } });
    expect(claim).not.toBeNull();
    expect(claim!.userId).toBeNull(); // anonymous after deletion
    cleanup.push(() => db.trialClaim.delete({ where: { id: claim!.id } }));
  });
});

describe("shopper data", () => {
  it("erasure removes personal data but keeps orders, unlinked", async () => {
    const store = await db.store.create({ data: { slug: `gdpr${run}`.slice(0, 30), name: "GDPR store", email: "s@example.com" } });
    cleanup.push(() => db.store.delete({ where: { id: store.id } }));
    const product = await db.product.create({ data: { storeId: store.id, title: "P", handle: "p", variants: { create: { title: "Default", priceCents: 100 } } }, include: { variants: true } });
    const email = `shopper.${run}@example.com`;
    const c = await db.customer.create({ data: { storeId: store.id, email, firstName: "Ana", addresses: { create: { firstName: "Ana", lastName: "P", address1: "x", city: "y", zip: "1", countryCode: "RO" } } } });
    const order = await db.order.create({ data: { storeId: store.id, number: 1, statusToken: `t${run}`, customerId: c.id, email, currency: "EUR", subtotalCents: 100, totalCents: 100, taxesIncluded: true, shippingAddress: {}, paymentMethod: "cod" } });
    await db.productReview.create({ data: { storeId: store.id, productId: product.id, name: "Ana", email, rating: 5, body: "Great product, really." } });
    await db.stockAlert.create({ data: { storeId: store.id, variantId: product.variants[0].id, email } });

    const exported = await exportCustomerData(store.id, c.id);
    expect(exported!.orders).toHaveLength(1);
    expect(exported!.reviews).toHaveLength(1);

    expect(await eraseCustomer(store.id, c.id, { byCustomer: true })).toBe(true);
    expect(await db.customer.findUnique({ where: { id: c.id } })).toBeNull();
    expect(await db.customerAddress.count({ where: { customerId: c.id } })).toBe(0);
    expect(await db.productReview.count({ where: { storeId: store.id, email } })).toBe(0);
    expect(await db.stockAlert.count({ where: { storeId: store.id, email } })).toBe(0);
    const kept = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(kept.customerId).toBeNull(); // legal retention, no longer linked to the person
  });

  it("cannot erase a customer of another store", async () => {
    const a = await db.store.create({ data: { slug: `ga${run}`.slice(0, 30), name: "A", email: "a@example.com" } });
    const b = await db.store.create({ data: { slug: `gb${run}`.slice(0, 30), name: "B", email: "b@example.com" } });
    cleanup.push(() => db.store.deleteMany({ where: { id: { in: [a.id, b.id] } } }));
    const c = await db.customer.create({ data: { storeId: a.id, email: `x.${run}@example.com` } });
    expect(await eraseCustomer(b.id, c.id, {})).toBe(false);
    expect(await exportCustomerData(b.id, c.id)).toBeNull();
    expect(await db.customer.findUnique({ where: { id: c.id } })).not.toBeNull();
  });
});

describe("retention", () => {
  it("deletes only data past its retention period", async () => {
    const store = await db.store.create({ data: { slug: `ret${run}`.slice(0, 30), name: "Ret", email: "r@example.com" } });
    cleanup.push(() => db.store.delete({ where: { id: store.id } }));
    const old = new Date(Date.now() - 120 * 86_400_000);
    const mk = async (createdAt: Date) => {
      const cart = await db.cart.create({ data: { storeId: store.id, token: `ret-${run}-${createdAt.getTime()}` } });
      return db.checkout.create({ data: { storeId: store.id, cartId: cart.id, email: "x@example.com", shippingAddress: {}, pricing: {}, paymentMethod: "cod", status: "EXPIRED", createdAt } });
    };
    const oldCheckout = await mk(old);
    const recent = await mk(new Date());
    await applyRetention();
    expect(await db.checkout.findUnique({ where: { id: oldCheckout.id } })).toBeNull();
    expect(await db.checkout.findUnique({ where: { id: recent.id } })).not.toBeNull();
  });
});
