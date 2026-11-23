import "server-only";
import type { User } from "@prisma/client";
import { db } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";
import { emailButton, emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { getTranslator } from "@/lib/i18n";
import { env } from "@/lib/env";

const TTL_MS = 48 * 3600_000;

/** Send (or re-send) the link proving the account owns its email address. */
export async function sendVerificationEmail(user: Pick<User, "id" | "email" | "locale">) {
  const token = randomToken();
  // Older links stop working once a new one is issued.
  await db.emailVerification.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
  await db.emailVerification.create({ data: { userId: user.id, email: user.email, tokenHash: sha256(token), expiresAt: new Date(Date.now() + TTL_MS) } });
  const t = getTranslator(user.locale);
  const url = `${env.appUrl}/verify-email/${token}`;
  await sendEmail({
    to: user.email,
    subject: t("email.verify.subject", { platform: env.platformName }),
    text: `${t("email.verify.body")}\n\n${url}`,
    html: emailLayout({ heading: t("email.verify.subject", { platform: env.platformName }), bodyHtml: `<p>${escapeHtml(t("email.verify.body"))}</p>${emailButton(url, t("email.verify.cta"))}` }),
  });
}

/** Consume a verification link. Valid only for the address it was sent to. */
export async function verifyEmailToken(token: string): Promise<"ok" | "invalid"> {
  if (!token || token.length > 128) return "invalid";
  const row = await db.emailVerification.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!row || row.usedAt || row.expiresAt < new Date() || row.user.email !== row.email) return "invalid";
  await db.$transaction([
    db.emailVerification.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    db.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: row.user.emailVerifiedAt ?? new Date() } }),
  ]);
  return "ok";
}
