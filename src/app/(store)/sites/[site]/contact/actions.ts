"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { loadStorefront } from "@/server/storefront";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/http";
import { emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { getTranslator } from "@/lib/i18n";
import { notifyStore } from "@/server/notifications";

export type ContactState = { ok?: boolean; message?: string; error?: string; at?: number } | null;

const MIN_FILL_MS = 2500; // bots submit instantly

export async function sendContactAction(site: string, _: ContactState, fd: FormData): Promise<ContactState> {
  const sf = await loadStorefront(site);
  const { t, store } = sf;
  if (!store.contactEnabled) return { error: t("sf.contact.disabled"), at: Date.now() };
  const startedAt = Number(fd.get("startedAt") ?? 0);
  const looksLikeBot = !!String(fd.get("website") ?? "") || !startedAt || Date.now() - startedAt < MIN_FILL_MS;
  if (looksLikeBot) return { ok: true, message: t("sf.contact.sent"), at: Date.now() }; // don't tell bots they were caught
  if (!(await rateLimit(`contact:${store.id}:${await clientIp()}`, 5, 3600))) return { error: t("auth.error.rateLimited"), at: Date.now() };
  const parsed = z.object({
    name: z.string().trim().min(1).max(100),
    email: z.string().trim().toLowerCase().email().max(200),
    subject: z.string().trim().max(150).optional().default(""),
    orderRef: z.string().trim().max(30).optional().default(""),
    message: z.string().trim().min(10).max(5000),
  }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: t("sf.contact.invalid"), at: Date.now() };
  const d = parsed.data;
  const msg = await db.contactMessage.create({ data: { storeId: store.id, name: d.name, email: d.email, subject: d.subject || null, orderRef: d.orderRef || null, message: d.message } });
  const tm = getTranslator(store.locale);
  const subject = tm("email.contact.subject", { store: store.name, subject: d.subject || tm("email.contact.noSubject") });
  // To the merchant, with Reply-To set to the customer: answering is one click.
  await sendEmail({
    to: store.email,
    replyTo: d.email,
    subject,
    text: `${d.name} <${d.email}>${d.orderRef ? ` · #${d.orderRef}` : ""}\n\n${d.message}`,
    html: emailLayout({ heading: subject, bodyHtml: `<p><strong>${escapeHtml(d.name)}</strong> &lt;${escapeHtml(d.email)}&gt;${d.orderRef ? ` · #${escapeHtml(d.orderRef)}` : ""}</p><p style="white-space:pre-line">${escapeHtml(d.message)}</p>` }),
  });
  await notifyStore(store.id, { type: "contact_message", data: { name: d.name, subject: d.subject || "—" }, href: `/admin/${store.slug}/inbox/${msg.id}` });
  return { ok: true, message: t("sf.contact.sent"), at: Date.now() };
}
