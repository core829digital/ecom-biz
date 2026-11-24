import "server-only";
import { z } from "zod";
import type { AutomationTrigger, EmailCampaign, Store } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { emailButton, emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { storePublicUrl } from "@/lib/tenant";
import { parseTheme } from "@/lib/theme";
import { getTranslator } from "@/lib/i18n";
import { notifyStore } from "@/server/notifications";
import { bodyToHtml, bodyToText } from "@/lib/marketing-render";

/**
 * Email marketing: one-off campaigns to newsletter subscribers and timed automations
 * (welcome series, first-purchase follow-up). Only SUBSCRIBED people (double opt-in or explicit
 * consent) ever receive anything, every email carries an unsubscribe link and header, and
 * sending is resumable: each recipient is a row that is claimed before sending (no duplicates).
 */

/** Emails can't actually be delivered (production without SMTP): sending is refused, drafts still work. */
export function emailDeliveryDisabled() {
  return env.isProduction && !env.smtpUrl;
}

export const messageSchema = z.object({
  subject: z.string().trim().min(1).max(150),
  preheader: z.string().trim().max(150).default(""),
  heading: z.string().trim().max(150).default(""),
  body: z.string().max(5000).default(""),
  ctaLabel: z.string().trim().max(40).default(""),
  ctaUrl: z.string().trim().max(500).default(""),
});
export type MarketingMessage = z.infer<typeof messageSchema>;

export const stepSchema = messageSchema.extend({ delayHours: z.number().int().min(0).max(24 * 60) });
export const stepsSchema = z.array(stepSchema).max(5);
export type AutomationStep = z.infer<typeof stepSchema>;

/** Absolute link for a button: store paths become store URLs; only http(s) otherwise. */
function absoluteUrl(publicUrl: string, url: string) {
  if (!url) return `${publicUrl}/collections/all`;
  if (url.startsWith("/") && !url.startsWith("//")) return `${publicUrl}${url}`;
  return /^https?:\/\//i.test(url) ? url : `${publicUrl}/collections/all`;
}

/** Builds the final email for one subscriber. */
export async function renderMarketingEmail(store: Store, msg: MarketingMessage, unsubscribeToken: string | null) {
  const t = getTranslator(store.locale);
  const theme = parseTheme(store.theme);
  const publicUrl = await storePublicUrl(store);
  const unsubscribeUrl = unsubscribeToken ? `${publicUrl}/newsletter/unsubscribe/${unsubscribeToken}` : `${publicUrl}`;
  const cta = msg.ctaLabel ? emailButton(absoluteUrl(publicUrl, msg.ctaUrl), msg.ctaLabel, theme.primaryColor) : "";
  const preheader = msg.preheader ? `<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(msg.preheader)}</div>` : "";
  const footer = `${store.name}${store.address1 ? ` · ${store.address1}${store.city ? `, ${store.city}` : ""}` : ""}`;
  const unsubscribe = `<p style="margin:24px 0 0;color:#71717a;font-size:12px">${escapeHtml(t("marketing.email.why", { store: store.name }))} <a href="${escapeHtml(unsubscribeUrl)}" style="color:#71717a">${escapeHtml(t("marketing.email.unsubscribe"))}</a></p>`;
  const html = emailLayout({
    heading: msg.heading || msg.subject,
    brandColor: theme.primaryColor,
    footer,
    bodyHtml: `${preheader}${bodyToHtml(msg.body)}${cta}${unsubscribe}`,
  });
  const text = [msg.heading || msg.subject, "", bodyToText(msg.body), msg.ctaLabel ? `\n${msg.ctaLabel}: ${absoluteUrl(publicUrl, msg.ctaUrl)}` : "", "", `${t("marketing.email.unsubscribe")}: ${unsubscribeUrl}`].join("\n");
  return { html, text, headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` } };
}

async function deliver(store: Store, msg: MarketingMessage, to: string, token: string | null) {
  const { html, text, headers } = await renderMarketingEmail(store, msg, token);
  return sendEmail({ to, subject: msg.subject, html, text, fromName: store.name, replyTo: store.email, headers });
}

export function campaignMessage(c: Pick<EmailCampaign, "subject" | "preheader" | "heading" | "body" | "ctaLabel" | "ctaUrl">): MarketingMessage {
  return { subject: c.subject, preheader: c.preheader, heading: c.heading, body: c.body, ctaLabel: c.ctaLabel, ctaUrl: c.ctaUrl };
}

export async function sendCampaignTest(campaignId: string, storeId: string, to: string) {
  const c = await db.emailCampaign.findFirstOrThrow({ where: { id: campaignId, storeId }, include: { store: true } });
  return deliver(c.store, campaignMessage(c), to, null);
}

export class CampaignError extends Error {
  constructor(public code: "email_disabled" | "no_recipients" | "not_draft") {
    super(code);
  }
}

/** Snapshot of the audience: one pending row per subscriber at the moment sending starts. */
export async function startCampaign(campaignId: string, storeId: string, at?: Date) {
  if (emailDeliveryDisabled()) throw new CampaignError("email_disabled");
  const c = await db.emailCampaign.findFirstOrThrow({ where: { id: campaignId, storeId } });
  if (c.status !== "DRAFT" && c.status !== "SCHEDULED") throw new CampaignError("not_draft");
  const subs = await db.newsletterSubscriber.findMany({ where: { storeId, status: "SUBSCRIBED" }, select: { id: true, email: true } });
  if (!subs.length) throw new CampaignError("no_recipients");
  if (at && at.getTime() > Date.now() + 60_000) {
    await db.emailCampaign.update({ where: { id: c.id }, data: { status: "SCHEDULED", scheduledAt: at } });
    return { scheduled: true, recipients: subs.length };
  }
  await db.$transaction([
    db.campaignSend.createMany({ data: subs.map((s) => ({ campaignId: c.id, subscriberId: s.id, email: s.email })), skipDuplicates: true }),
    db.emailCampaign.update({ where: { id: c.id }, data: { status: "SENDING", startedAt: new Date(), scheduledAt: null, recipientCount: subs.length } }),
  ]);
  return { scheduled: false, recipients: subs.length };
}

/** Cron: starts due scheduled campaigns and sends the next batch of every campaign in progress. */
export async function processCampaigns(budget = 250) {
  if (emailDeliveryDisabled()) return { sent: 0, skipped: "email_disabled" };
  for (const due of await db.emailCampaign.findMany({ where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } }, select: { id: true, storeId: true }, take: 20 })) {
    await startCampaign(due.id, due.storeId).catch(async (e) => {
      if (e instanceof CampaignError && e.code === "no_recipients") await db.emailCampaign.update({ where: { id: due.id }, data: { status: "SENT", finishedAt: new Date() } });
    });
  }
  let sent = 0;
  const running = await db.emailCampaign.findMany({ where: { status: "SENDING" }, include: { store: true }, orderBy: { startedAt: "asc" }, take: 10 });
  for (const c of running) {
    const batch = await db.campaignSend.findMany({ where: { campaignId: c.id, status: "PENDING" }, take: Math.max(1, budget - sent) });
    const msg = campaignMessage(c);
    for (const row of batch) {
      // Claim the row first: overlapping cron runs never send twice.
      const claimed = await db.campaignSend.updateMany({ where: { id: row.id, status: "PENDING" }, data: { status: "CLAIMED" } });
      if (!claimed.count) continue;
      const sub = await db.newsletterSubscriber.findUnique({ where: { id: row.subscriberId } });
      if (!sub || sub.status !== "SUBSCRIBED") {
        await db.campaignSend.update({ where: { id: row.id }, data: { status: "SKIPPED" } });
        continue;
      }
      const ok = await deliver(c.store, msg, sub.email, sub.token);
      await db.$transaction([
        db.campaignSend.update({ where: { id: row.id }, data: { status: ok ? "SENT" : "FAILED", sentAt: new Date() } }),
        db.emailCampaign.update({ where: { id: c.id }, data: ok ? { sentCount: { increment: 1 } } : { failedCount: { increment: 1 } } }),
      ]);
      sent++;
    }
    const left = await db.campaignSend.count({ where: { campaignId: c.id, status: { in: ["PENDING", "CLAIMED"] } } });
    if (!left) {
      const done = await db.emailCampaign.update({ where: { id: c.id }, data: { status: "SENT", finishedAt: new Date() } });
      await notifyStore(c.storeId, { type: "campaign_sent", data: { subject: done.subject, sent: done.sentCount }, href: `/admin/${c.store.slug}/marketing/campaigns/${c.id}` });
    }
    if (sent >= budget) break;
  }
  return { sent };
}

/** Rows left CLAIMED by a crashed run go back to the queue after 15 minutes. */
export async function releaseStuckSends() {
  const stale = await db.campaignSend.findMany({ where: { status: "CLAIMED", sentAt: null, campaign: { status: "SENDING", updatedAt: { lt: new Date(Date.now() - 15 * 60_000) } } }, select: { id: true }, take: 1000 });
  if (stale.length) await db.campaignSend.updateMany({ where: { id: { in: stale.map((s) => s.id) } }, data: { status: "PENDING" } });
  return stale.length;
}

// ───────────────────────────── Automations ─────────────────────────────

export function parseSteps(json: unknown): AutomationStep[] {
  const r = stepsSchema.safeParse(json);
  return r.success ? r.data : [];
}

/** Starts the automation for a subscriber (once per person and automation). Never throws. */
export async function enrollInAutomation(storeId: string, trigger: AutomationTrigger, subscriber: { id: string; email: string }) {
  try {
    const a = await db.emailAutomation.findUnique({ where: { storeId_trigger: { storeId, trigger } } });
    const steps = parseSteps(a?.steps);
    if (!a?.enabled || !steps.length) return;
    await db.automationRun.upsert({
      where: { automationId_subscriberId: { automationId: a.id, subscriberId: subscriber.id } },
      create: { automationId: a.id, subscriberId: subscriber.id, email: subscriber.email, nextAt: new Date(Date.now() + steps[0].delayHours * 3600_000) },
      update: {},
    });
  } catch (e) {
    console.error("[automation] enroll failed", e);
  }
}

/** Cron: sends every automation step that is due. */
export async function processAutomations(budget = 250) {
  if (emailDeliveryDisabled()) return { sent: 0, skipped: "email_disabled" };
  const due = await db.automationRun.findMany({ where: { doneAt: null, nextAt: { lte: new Date() } }, include: { automation: { include: { store: true } } }, orderBy: { nextAt: "asc" }, take: budget });
  let sent = 0;
  for (const run of due) {
    // Claim: push nextAt forward so an overlapping run skips it.
    const claimed = await db.automationRun.updateMany({ where: { id: run.id, nextAt: run.nextAt, doneAt: null }, data: { nextAt: new Date(Date.now() + 15 * 60_000) } });
    if (!claimed.count) continue;
    const steps = parseSteps(run.automation.steps);
    const sub = await db.newsletterSubscriber.findUnique({ where: { id: run.subscriberId } });
    const step = steps[run.step];
    if (!run.automation.enabled || !step || !sub || sub.status !== "SUBSCRIBED") {
      await db.automationRun.update({ where: { id: run.id }, data: { doneAt: new Date() } });
      continue;
    }
    await deliver(run.automation.store, step, sub.email, sub.token);
    sent++;
    const next = steps[run.step + 1];
    await db.automationRun.update({
      where: { id: run.id },
      data: next ? { step: run.step + 1, nextAt: new Date(Date.now() + next.delayHours * 3600_000) } : { step: run.step + 1, doneAt: new Date() },
    });
  }
  return { sent };
}

/** Ready-to-edit sequences in the store's language (disabled until the merchant turns them on). */
export function defaultSteps(trigger: AutomationTrigger, locale: string, storeName: string): AutomationStep[] {
  const it = locale === "it";
  if (trigger === "WELCOME") {
    return [
      { delayHours: 0, subject: it ? `Benvenuto in ${storeName}` : `Welcome to ${storeName}`, preheader: "", heading: it ? "Grazie per l'iscrizione!" : "Thanks for subscribing!", body: it ? "Da oggi sarai il primo a sapere di novità, lanci e offerte.\n\nDai un'occhiata ai nostri prodotti più amati." : "From now on you'll be the first to hear about new arrivals, launches and offers.\n\nHave a look at our most loved products.", ctaLabel: it ? "Scopri il negozio" : "Visit the store", ctaUrl: "/collections/all" },
      { delayHours: 72, subject: it ? "La nostra storia" : "Our story", preheader: "", heading: it ? "Chi siamo" : "Who we are", body: it ? "Ogni prodotto nasce con cura. Ecco perché facciamo quello che facciamo." : "Every product is made with care. Here's why we do what we do.", ctaLabel: it ? "Leggi di più" : "Read more", ctaUrl: "/" },
    ];
  }
  return [
    { delayHours: 72, subject: it ? "Com'è andata?" : "How did it go?", preheader: "", heading: it ? "Grazie per il tuo acquisto" : "Thank you for your order", body: it ? "Speriamo che ti piaccia. Se hai un momento, lasciaci una recensione: aiuta tantissimo." : "We hope you love it. If you have a moment, leave us a review: it helps a lot.", ctaLabel: it ? "Torna al negozio" : "Back to the store", ctaUrl: "/" },
  ];
}
