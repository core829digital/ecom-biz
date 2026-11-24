/** Email campaigns and automations against the real database (emails captured). */
import { afterAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mails: { to: string; subject: string; text: string; headers?: Record<string, string> }[] = [];
vi.mock("@/lib/email", async (orig) => ({ ...(await orig<typeof import("@/lib/email")>()), sendEmail: async (e: (typeof mails)[number]) => (mails.push(e), true) }));

const { db } = await import("@/lib/db");
const { subscribe, unsubscribe } = await import("@/server/newsletter");
const { startCampaign, processCampaigns, processAutomations, enrollInAutomation, CampaignError } = await import("@/server/marketing");

const run = Date.now().toString(36);
const stores: string[] = [];
afterAll(async () => {
  await db.store.deleteMany({ where: { id: { in: stores } } });
  await db.$disconnect();
});
const mkStore = async (n: string) => {
  const s = await db.store.create({ data: { slug: `mk${n}${run}`.slice(0, 30), name: `MK ${n}`, email: "s@example.com", newsletterEnabled: true } });
  stores.push(s.id);
  return s;
};

describe("campaigns", () => {
  it("sends once to each subscriber, skips people who unsubscribed meanwhile, includes unsubscribe link + header", async () => {
    const store = await mkStore("a");
    for (const e of ["a@x.test", "b@x.test", "c@x.test"]) await subscribe(store, e, "admin");
    await subscribe(store, "pending@x.test", "form"); // never confirmed: must not receive
    const c = await db.emailCampaign.create({ data: { storeId: store.id, subject: `Sale ${run}`, body: "Hello **there**", ctaLabel: "Shop", ctaUrl: "/collections/all" } });
    const res = await startCampaign(c.id, store.id);
    expect(res.recipients).toBe(3);
    const b = await db.newsletterSubscriber.findFirstOrThrow({ where: { storeId: store.id, email: "b@x.test" } });
    await unsubscribe(store.id, b.token);

    await Promise.all([processCampaigns(), processCampaigns()]); // overlapping cron runs
    const mine = mails.filter((m) => m.subject === `Sale ${run}`);
    expect(mine.map((m) => m.to).sort()).toEqual(["a@x.test", "c@x.test"]);
    expect(mine[0].headers?.["List-Unsubscribe"]).toContain("/newsletter/unsubscribe/");
    expect(mine[0].text).toContain("/newsletter/unsubscribe/");

    const done = await db.emailCampaign.findUniqueOrThrow({ where: { id: c.id } });
    expect([done.status, done.sentCount, done.recipientCount]).toEqual(["SENT", 2, 3]);
    await expect(startCampaign(c.id, store.id)).rejects.toBeInstanceOf(CampaignError);
  });

  it("refuses to start with nobody subscribed, and schedules future sends", async () => {
    const store = await mkStore("b");
    const c = await db.emailCampaign.create({ data: { storeId: store.id, subject: "Empty" } });
    await expect(startCampaign(c.id, store.id)).rejects.toMatchObject({ code: "no_recipients" });
    await subscribe(store, "z@x.test", "admin");
    const at = new Date(Date.now() + 3600_000);
    expect((await startCampaign(c.id, store.id, at)).scheduled).toBe(true);
    expect((await db.emailCampaign.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("SCHEDULED");
  });
});

describe("automations", () => {
  it("runs the welcome steps in order, once per person, and stops after unsubscribe", async () => {
    const store = await mkStore("c");
    await db.emailAutomation.create({
      data: {
        storeId: store.id, trigger: "WELCOME", enabled: true,
        steps: [
          { delayHours: 0, subject: `W1 ${run}`, preheader: "", heading: "", body: "one", ctaLabel: "", ctaUrl: "" },
          { delayHours: 0, subject: `W2 ${run}`, preheader: "", heading: "", body: "two", ctaLabel: "", ctaUrl: "" },
          { delayHours: 0, subject: `W3 ${run}`, preheader: "", heading: "", body: "three", ctaLabel: "", ctaUrl: "" },
        ],
      },
    });
    await subscribe(store, "w@x.test", "admin"); // enrols
    const sub = await db.newsletterSubscriber.findFirstOrThrow({ where: { storeId: store.id, email: "w@x.test" } });
    await enrollInAutomation(store.id, "WELCOME", sub); // second enrolment is a no-op
    await processAutomations();
    await db.automationRun.updateMany({ where: { email: "w@x.test" }, data: { nextAt: new Date(Date.now() - 1000) } });
    await processAutomations();
    expect(mails.filter((m) => m.to === "w@x.test").map((m) => m.subject)).toEqual([`W1 ${run}`, `W2 ${run}`]);
    await unsubscribe(store.id, sub.token);
    await db.automationRun.updateMany({ where: { email: "w@x.test" }, data: { nextAt: new Date(Date.now() - 1000) } });
    await processAutomations();
    expect(mails.filter((m) => m.to === "w@x.test")).toHaveLength(2);
    expect((await db.automationRun.findFirstOrThrow({ where: { email: "w@x.test" } })).doneAt).not.toBeNull();
  });
});
