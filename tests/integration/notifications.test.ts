/** Notifications: delivery to the right people, language, preferences, dedupe and privacy. */
import { afterAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const sent: string[] = [];
vi.mock("@/lib/email", async (orig) => ({ ...(await orig<typeof import("@/lib/email")>()), sendEmail: async (e: { to: string }) => (sent.push(e.to), true) }));

const { db } = await import("@/lib/db");
const { notifyStore, notifyUsers, renderNotification, recentlyNotified } = await import("@/server/notifications");

const run = Date.now().toString(36);
let storeId = "";
const users: string[] = [];
afterAll(async () => {
  if (storeId) await db.store.delete({ where: { id: storeId } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});

describe("notifications", () => {
  it("reaches the right roles, in each person's language, emailing only who opted in", async () => {
    const owner = await db.user.create({ data: { email: `own.${run}@example.com`, name: "Owner", passwordHash: "x", locale: "it" } });
    const staff = await db.user.create({ data: { email: `stf.${run}@example.com`, name: "Staff", passwordHash: "x", notificationPrefs: { order_dispute: { email: false } } } });
    const outsider = await db.user.create({ data: { email: `out.${run}@example.com`, name: "Out", passwordHash: "x" } });
    users.push(owner.id, staff.id, outsider.id);
    const store = await db.store.create({ data: { slug: `nt${run}`.slice(0, 30), name: "N", email: "n@example.com", memberships: { create: [{ userId: owner.id, role: "OWNER" }, { userId: staff.id, role: "ADMIN" }] } } });
    storeId = store.id;

    await notifyStore(store.id, { type: "order_dispute", data: { number: 7, reason: "fraudulent" }, href: "/admin/x/orders/1" }, ["OWNER", "ADMIN"]);
    const rows = await db.notification.findMany({ where: { storeId: store.id } });
    expect(rows.map((r) => r.userId).sort()).toEqual([owner.id, staff.id].sort());
    expect(await db.notification.count({ where: { userId: outsider.id } })).toBe(0);
    // Email default for disputes is on; the admin opted out.
    expect(sent).toContain(owner.email);
    expect(sent).not.toContain(staff.email);
    expect(renderNotification(rows[0], "it").title).toBe("Contestazione sull'ordine #7");
    expect(renderNotification(rows[0], "en").title).toBe("Payment dispute on order #7");
  });

  it("translates system values but never user-typed text", async () => {
    const joined = renderNotification({ type: "staff_joined", data: { name: "OWNER", role: "ADMIN" } }, "it");
    expect(joined.title).toBe("OWNER si è unito al team"); // the typed name stays as typed
    expect(joined.body).toBe("Ruolo: Amministratore");
    expect(renderNotification({ type: "security_2fa_changed", data: { state: "off" } }, "it").body).toContain("disattivata");
  });

  it("dedupes repeated alerts about the same thing", async () => {
    expect(await recentlyNotified(storeId, "low_stock", `variant-${run}`)).toBe(false);
    await notifyStore(storeId, { type: "low_stock", data: { key: `variant-${run}`, title: "Mug", qty: 2 } });
    expect(await recentlyNotified(storeId, "low_stock", `variant-${run}`)).toBe(true);
  });

  it("ignores unknown people without failing the caller", async () => {
    await expect(notifyUsers(["does-not-exist"], { type: "billing_hold" })).resolves.toBeUndefined();
  });
});
