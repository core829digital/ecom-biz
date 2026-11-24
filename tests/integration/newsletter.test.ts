/** Newsletter consent flows against the real database (emails captured). */
import { afterAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mails: { to: string; text: string }[] = [];
vi.mock("@/lib/email", async (orig) => ({ ...(await orig<typeof import("@/lib/email")>()), sendEmail: async (e: { to: string; text: string }) => (mails.push(e), true) }));

const { db } = await import("@/lib/db");
const { subscribe, confirmSubscription, unsubscribe } = await import("@/server/newsletter");

const run = Date.now().toString(36);
const stores: string[] = [];
afterAll(async () => {
  await db.store.deleteMany({ where: { id: { in: stores } } });
  await db.$disconnect();
});
const mkStore = async (n: string) => {
  const s = await db.store.create({ data: { slug: `nl${n}${run}`.slice(0, 30), name: `NL ${n}`, email: "s@example.com" } });
  stores.push(s.id);
  return s;
};

describe("newsletter (double opt-in)", () => {
  it("a form sign-up is not subscribed until the confirmation link is clicked", async () => {
    const store = await mkStore("a");
    expect(await subscribe(store, "Ana@Example.com", "form")).toBe("confirm_sent");
    const sub = await db.newsletterSubscriber.findUniqueOrThrow({ where: { storeId_email: { storeId: store.id, email: "ana@example.com" } } });
    expect(sub.status).toBe("PENDING");
    expect(sub.consentAt).toBeNull();
    const mail = mails.find((m) => m.to === "ana@example.com")!;
    expect(mail.text).toContain(`/newsletter/confirm/${sub.token}`);

    expect(await confirmSubscription(store.id, sub.token)).toBe(true);
    const confirmed = await db.newsletterSubscriber.findUniqueOrThrow({ where: { id: sub.id } });
    expect(confirmed.status).toBe("SUBSCRIBED");
    expect(confirmed.consentAt).not.toBeNull(); // proof of consent
    expect(await subscribe(store, "ana@example.com", "form")).toBe("already");

    expect(await unsubscribe(store.id, sub.token)).toBe(true);
    expect((await db.newsletterSubscriber.findUniqueOrThrow({ where: { id: sub.id } })).status).toBe("UNSUBSCRIBED");
  });

  it("checkout consent subscribes directly and keeps the source", async () => {
    const store = await mkStore("b");
    expect(await subscribe(store, "bob@example.com", "checkout")).toBe("subscribed");
    const s = await db.newsletterSubscriber.findUniqueOrThrow({ where: { storeId_email: { storeId: store.id, email: "bob@example.com" } } });
    expect(s).toMatchObject({ status: "SUBSCRIBED", source: "checkout" });
  });

  it("tokens only work in their own store", async () => {
    const a = await mkStore("c");
    const b = await mkStore("d");
    await subscribe(a, "cara@example.com", "form");
    const sub = await db.newsletterSubscriber.findUniqueOrThrow({ where: { storeId_email: { storeId: a.id, email: "cara@example.com" } } });
    expect(await confirmSubscription(b.id, sub.token)).toBe(false);
    expect(await unsubscribe(b.id, sub.token)).toBe(false);
    expect(await confirmSubscription(a.id, "not-a-token")).toBe(false);
  });
});
