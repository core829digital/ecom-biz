import "server-only";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { removeStoreFiles } from "@/lib/storage";
import { recordTrialClaims } from "@/server/trial";
import { audit } from "@/server/audit";

/**
 * GDPR data-subject rights.
 *
 * Merchants (platform accounts): the platform is the controller → self-service export and erasure.
 * Shoppers (store customers): the merchant is the controller, the platform the processor → the
 * merchant (or the shopper from their store account) exports or erases. Orders are kept, unlinked
 * from the person, because tax law requires keeping sales records (GDPR art. 17(3)(b)).
 */

// ───────────────────────────── Merchants ─────────────────────────────

export async function exportUserData(userId: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      plan: { select: { name: true, priceCents: true, currency: true, interval: true } },
      memberships: { include: { store: { select: { id: true, name: true, slug: true, createdAt: true } } } },
      sessions: { select: { createdAt: true, lastSeenAt: true, expiresAt: true, ip: true, userAgent: true } },
      auditLogs: { select: { action: true, target: true, createdAt: true, storeId: true }, orderBy: { createdAt: "desc" }, take: 5000 },
    },
  });
  // Never export secrets (password hash, 2FA seed, recovery codes) or internal anti-fraud hashes.
  return {
    exportedAt: new Date().toISOString(),
    account: {
      id: user.id, name: user.name, email: user.email, emailVerifiedAt: user.emailVerifiedAt, locale: user.locale, createdAt: user.createdAt,
      twoFactorEnabled: !!user.totpEnabledAt, theme: user.theme, accent: user.accent,
    },
    subscription: {
      plan: user.plan, status: user.subscriptionStatus, trialEndsAt: user.trialEndsAt, trialUsedAt: user.trialUsedAt,
      currentPeriodEnd: user.currentPeriodEnd, cancelAtPeriodEnd: user.cancelAtPeriodEnd,
    },
    stores: user.memberships.map((m) => ({ ...m.store, role: m.role, memberSince: m.createdAt })),
    sessions: user.sessions,
    activity: user.auditLogs,
  };
}

export class AccountDeletionError extends Error {
  constructor(public code: "owns_stores" | "last_platform_admin") {
    super(code);
  }
}

/** Delete a merchant account. Owned stores are deleted too, only when explicitly confirmed. */
export async function deleteUserAccount(userId: string, opts: { deleteOwnedStores: boolean }) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, include: { memberships: { where: { role: "OWNER" }, select: { storeId: true } } } });
  if (user.memberships.length && !opts.deleteOwnedStores) throw new AccountDeletionError("owns_stores");
  if (user.isPlatformAdmin && (await db.user.count({ where: { isPlatformAdmin: true } })) <= 1) throw new AccountDeletionError("last_platform_admin");

  // 1. Stop billing now (no further charges).
  const stripe = getStripe();
  if (stripe && user.stripeSubscriptionId) {
    await stripe.subscriptions.cancel(user.stripeSubscriptionId, { prorate: false }).catch((e) => console.error("[gdpr] cancel subscription", e));
  }
  // 2. Keep the anonymous anti-abuse record: deleting an account must not unlock a new trial.
  if (user.trialUsedAt) await recordTrialClaims(user.id, { email: user.email });

  // 3. Owned stores (all their data) and their uploaded files.
  const storeIds = user.memberships.map((m) => m.storeId);
  for (const storeId of storeIds) {
    await db.store.delete({ where: { id: storeId } });
    await removeStoreFiles(storeId).catch((e) => console.error("[gdpr] store files", storeId, e));
  }
  // 4. The account (sessions, memberships, tokens cascade; audit entries are kept without the person).
  await db.user.delete({ where: { id: user.id } });
  await audit({ action: "account.deleted", meta: { stores: storeIds.length } });
  return { deletedStores: storeIds.length };
}

// ───────────────────────────── Shoppers ─────────────────────────────

export async function exportCustomerData(storeId: string, customerId: string) {
  const c = await db.customer.findFirst({
    where: { id: customerId, storeId },
    include: {
      addresses: true,
      orders: { include: { lines: { select: { title: true, variantTitle: true, sku: true, quantity: true, priceCents: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!c) return null;
  const [reviews, stockAlerts, newsletter, messages] = await Promise.all([
    db.productReview.findMany({ where: { storeId, email: c.email }, select: { rating: true, title: true, body: true, status: true, createdAt: true, product: { select: { title: true } } } }),
    db.stockAlert.findMany({ where: { storeId, email: c.email }, select: { createdAt: true, notifiedAt: true, variant: { select: { title: true, product: { select: { title: true } } } } } }),
    db.newsletterSubscriber.findUnique({ where: { storeId_email: { storeId, email: c.email } }, select: { status: true, source: true, consentAt: true, unsubscribedAt: true, createdAt: true } }),
    db.contactMessage.findMany({ where: { storeId, email: c.email }, select: { subject: true, message: true, createdAt: true } }),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    customer: {
      email: c.email, firstName: c.firstName, lastName: c.lastName, phone: c.phone, acceptsMarketing: c.acceptsMarketing,
      hasAccount: !!c.passwordHash, createdAt: c.createdAt,
    },
    addresses: c.addresses.map(({ id: _id, customerId: _c, ...a }) => a),
    orders: c.orders.map((o) => ({
      number: o.number, createdAt: o.createdAt, currency: o.currency, total: o.totalCents / 100, financialStatus: o.financialStatus,
      fulfillmentStatus: o.fulfillmentStatus, shippingAddress: o.shippingAddress, billingAddress: o.billingAddress,
      lines: o.lines.map((l) => ({ ...l, price: l.priceCents / 100, priceCents: undefined })),
    })),
    reviews,
    stockAlerts,
    newsletter,
    contactMessages: messages,
  };
}

/**
 * Erase a shopper's personal data in one store: profile, addresses, sessions, reviews, alerts,
 * marketing consent and unfinished checkouts. Completed orders stay (legal retention), unlinked.
 */
export async function eraseCustomer(storeId: string, customerId: string, actor: { userId?: string; byCustomer?: boolean }) {
  const c = await db.customer.findFirst({ where: { id: customerId, storeId } });
  if (!c) return false;
  await db.$transaction([
    db.productReview.deleteMany({ where: { storeId, email: c.email } }),
    db.stockAlert.deleteMany({ where: { storeId, email: c.email } }),
    db.newsletterSubscriber.deleteMany({ where: { storeId, email: c.email } }),
    db.contactMessage.deleteMany({ where: { storeId, email: c.email } }),
    db.checkout.deleteMany({ where: { storeId, email: c.email, status: { not: "COMPLETED" } } }),
    db.cart.updateMany({ where: { storeId, email: c.email }, data: { email: null } }),
    db.cart.updateMany({ where: { storeId, customerId: c.id }, data: { customerId: null } }),
    db.order.updateMany({ where: { storeId, customerId: c.id }, data: { customerId: null } }),
    db.customer.delete({ where: { id: c.id } }),
  ]);
  await audit({ storeId, userId: actor.userId ?? null, action: actor.byCustomer ? "customer.self_erased" : "customer.erased", target: c.id });
  return true;
}
