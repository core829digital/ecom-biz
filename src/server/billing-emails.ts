import "server-only";
import type { User } from "@prisma/client";
import { emailButton, emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { getTranslator } from "@/lib/i18n";
import { env } from "@/lib/env";
import { graceEndsAt } from "@/lib/billing-rules";

type Kind = "trial_ending" | "payment_failed";

/** Account-level billing emails (the merchant is the recipient). */
export async function sendBillingEmail(user: Pick<User, "email" | "locale" | "name">, kind: Kind, opts: { date: Date | null }) {
  const t = getTranslator(user.locale);
  const fmt = (d: Date) => new Intl.DateTimeFormat(user.locale === "it" ? "it-IT" : "en-GB", { dateStyle: "long" }).format(d);
  const url = `${env.appUrl}/account/billing`;
  const date = kind === "payment_failed" ? fmt(graceEndsAt(opts.date ?? new Date())) : opts.date ? fmt(opts.date) : "";
  const subject = t(`email.billing.${kind}.subject`, { platform: env.platformName });
  const body = t(`email.billing.${kind}.body`, { date, platform: env.platformName });
  await sendEmail({
    to: user.email,
    subject,
    text: `${body}\n\n${url}`,
    html: emailLayout({ heading: subject, bodyHtml: `<p>${escapeHtml(body)}</p>${emailButton(url, t(`email.billing.${kind}.cta`))}` }),
  });
}
