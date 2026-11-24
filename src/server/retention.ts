import "server-only";
import { db } from "@/lib/db";

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);

/**
 * Storage limitation (GDPR art. 5(1)(e)): personal data that is no longer needed is deleted on a
 * schedule. Orders are not touched here: the merchant keeps them for tax law.
 * Periods are documented in docs/GDPR.md and in the privacy policy.
 */
export const RETENTION_DAYS = {
  abandonedCheckouts: 90, // emails and addresses typed into unfinished checkouts
  abandonedCarts: 60,
  stockAlertsNotified: 90,
  stockAlertsPending: 365,
  usedTokens: 7, // password reset / email verification links after expiry
  webhookDeliveriesOk: 30,
  webhookDeliveriesFailed: 90,
  auditLog: 730, // security log: 2 years
  networkTrialClaims: 60, // only the last 30 days are ever checked
  trialClaims: 3 * 365, // anti-abuse ledger (hashes only)
  notifications: 90,
  unconfirmedSubscribers: 30, // newsletter sign-ups never confirmed (double opt-in)
  contactMessages: 730,
} as const;

export async function applyRetention() {
  const r = RETENTION_DAYS;
  const results = await db.$transaction([
    db.checkout.deleteMany({ where: { status: { not: "COMPLETED" }, createdAt: { lt: ago(r.abandonedCheckouts) } } }),
    db.cart.deleteMany({ where: { updatedAt: { lt: ago(r.abandonedCarts) }, completedAt: null, checkouts: { none: {} } } }),
    db.stockAlert.deleteMany({ where: { OR: [{ notifiedAt: { lt: ago(r.stockAlertsNotified) } }, { createdAt: { lt: ago(r.stockAlertsPending) } }] } }),
    db.passwordReset.deleteMany({ where: { expiresAt: { lt: ago(r.usedTokens) } } }),
    db.customerPasswordReset.deleteMany({ where: { expiresAt: { lt: ago(r.usedTokens) } } }),
    db.emailVerification.deleteMany({ where: { expiresAt: { lt: ago(r.usedTokens) } } }),
    db.webhookDelivery.deleteMany({ where: { OR: [{ success: true, createdAt: { lt: ago(r.webhookDeliveriesOk) } }, { createdAt: { lt: ago(r.webhookDeliveriesFailed) } }] } }),
    db.auditLog.deleteMany({ where: { createdAt: { lt: ago(r.auditLog) } } }),
    db.trialClaim.deleteMany({ where: { OR: [{ kind: "NETWORK", createdAt: { lt: ago(r.networkTrialClaims) } }, { createdAt: { lt: ago(r.trialClaims) } }] } }),
    db.notification.deleteMany({ where: { createdAt: { lt: ago(r.notifications) } } }),
    db.newsletterSubscriber.deleteMany({ where: { status: "PENDING", createdAt: { lt: ago(r.unconfirmedSubscribers) } } }),
    db.contactMessage.deleteMany({ where: { createdAt: { lt: ago(r.contactMessages) } } }),
  ]);
  const names = ["checkouts", "carts", "stockAlerts", "passwordResets", "customerPasswordResets", "emailVerifications", "webhookDeliveries", "auditLog", "trialClaims", "notifications", "unconfirmedSubscribers", "contactMessages"];
  return Object.fromEntries(names.map((n, i) => [n, results[i].count]));
}
