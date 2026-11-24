import "server-only";
import type { Store } from "@prisma/client";
import { db } from "@/lib/db";
import { randomToken } from "@/lib/crypto";
import { getTranslator } from "@/lib/i18n";
import { emailButton, emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { storePublicUrl } from "@/lib/tenant";
import { enrollInAutomation } from "@/server/marketing";

/**
 * Newsletter subscriptions (the merchant is the controller). Sign-ups from the store form use
 * double opt-in: nothing is subscribed until the person clicks the confirmation link, which is
 * also the proof of consent. An explicit, unticked-by-default checkbox at checkout is consent too.
 */
export type SubscribeResult = "confirm_sent" | "already" | "subscribed";

export async function subscribe(store: Store, rawEmail: string, source: "form" | "checkout" | "admin"): Promise<SubscribeResult> {
  const email = rawEmail.trim().toLowerCase();
  const existing = await db.newsletterSubscriber.findUnique({ where: { storeId_email: { storeId: store.id, email } } });
  if (existing?.status === "SUBSCRIBED") return "already";
  if (source !== "form") {
    // Consent given directly (checkout checkbox, or a merchant importing someone who agreed).
    const sub = await db.newsletterSubscriber.upsert({
      where: { storeId_email: { storeId: store.id, email } },
      create: { storeId: store.id, email, status: "SUBSCRIBED", token: randomToken(24), source, consentAt: new Date() },
      update: { status: "SUBSCRIBED", source, consentAt: new Date(), unsubscribedAt: null },
    });
    await enrollInAutomation(store.id, "WELCOME", sub);
    return "subscribed";
  }
  const sub = await db.newsletterSubscriber.upsert({
    where: { storeId_email: { storeId: store.id, email } },
    create: { storeId: store.id, email, status: "PENDING", token: randomToken(24), source },
    // A new request re-sends confirmation with a fresh link; it never subscribes without the click.
    update: { status: "PENDING", token: randomToken(24), source },
  });
  const t = getTranslator(store.locale);
  const url = `${await storePublicUrl(store)}/newsletter/confirm/${sub.token}`;
  await sendEmail({
    to: email,
    fromName: store.name,
    subject: t("email.newsletterConfirm.subject", { store: store.name }),
    text: `${t("email.newsletterConfirm.body", { store: store.name })}\n\n${url}\n\n${t("email.newsletterConfirm.ignore")}`,
    html: emailLayout({
      heading: t("email.newsletterConfirm.subject", { store: store.name }),
      bodyHtml: `<p>${escapeHtml(t("email.newsletterConfirm.body", { store: store.name }))}</p>${emailButton(url, t("email.newsletterConfirm.cta"))}<p style="color:#71717a;font-size:13px">${escapeHtml(t("email.newsletterConfirm.ignore"))}</p>`,
    }),
  });
  return "confirm_sent";
}

export async function confirmSubscription(storeId: string, token: string) {
  if (!token || token.length > 64) return false;
  const res = await db.newsletterSubscriber.updateMany({ where: { storeId, token, status: "PENDING" }, data: { status: "SUBSCRIBED", consentAt: new Date() } });
  if (res.count) {
    const sub = await db.newsletterSubscriber.findFirst({ where: { storeId, token } });
    if (sub) await enrollInAutomation(storeId, "WELCOME", sub);
  }
  return res.count > 0 || !!(await db.newsletterSubscriber.findFirst({ where: { storeId, token, status: "SUBSCRIBED" }, select: { id: true } }));
}

export async function unsubscribe(storeId: string, token: string) {
  if (!token || token.length > 64) return false;
  const res = await db.newsletterSubscriber.updateMany({ where: { storeId, token, status: { not: "UNSUBSCRIBED" } }, data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() } });
  if (res.count) {
    // Keep the customer record consistent with the withdrawal of consent.
    const sub = await db.newsletterSubscriber.findFirst({ where: { storeId, token }, select: { email: true } });
    if (sub) await db.customer.updateMany({ where: { storeId, email: sub.email }, data: { acceptsMarketing: false } });
  }
  return res.count > 0 || !!(await db.newsletterSubscriber.findFirst({ where: { storeId, token }, select: { id: true } }));
}
