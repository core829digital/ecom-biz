/**
 * Pure subscription rules (no I/O), so every business case is unit-tested.
 *
 * Lifecycle of an account:
 *   signup ─(verify email)─► NONE ─(checkout with card)─► TRIALING ─(trial ends, card charged)─► ACTIVE
 *                                                             │                                   │
 *                       cancel during trial: ends now ◄───────┘        renewal fails ─► PAST_DUE ─┤ (grace period)
 *                       (the trial is never granted again)                                         ▼
 *                                                                      not paid in time / cancelled ─► CANCELED
 * A payment dispute (chargeback) puts the account on hold regardless of status.
 */

export const PAST_DUE_GRACE_DAYS = 7;
/** Max trials started from the same network in the window below (offices share IPs, so this is generous). */
export const NETWORK_TRIAL_LIMIT = 3;
export const NETWORK_WINDOW_DAYS = 30;

const DAY = 86_400_000;

export type BillingState = {
  subscriptionStatus: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "NONE";
  trialEndsAt: Date | null;
  pastDueSince?: Date | null;
  billingHold?: boolean;
};

/** Whether an account may operate (its stores sell). */
export function accountActive(u: BillingState, now = new Date()): boolean {
  if (u.billingHold) return false;
  switch (u.subscriptionStatus) {
    case "ACTIVE":
      return true;
    case "TRIALING":
      return !u.trialEndsAt || u.trialEndsAt > now;
    case "PAST_DUE":
      // Stripe retries the card; the merchant keeps selling for a grace period meanwhile.
      return !!u.pastDueSince && u.pastDueSince.getTime() + PAST_DUE_GRACE_DAYS * DAY > now.getTime();
    default:
      return false;
  }
}

/** Last moment a past-due account keeps working, for banners. */
export function graceEndsAt(pastDueSince: Date) {
  return new Date(pastDueSince.getTime() + PAST_DUE_GRACE_DAYS * DAY);
}

/**
 * Stores allowed to operate under the plan's store limit: the oldest ones. Downgrading
 * from a bigger plan therefore pauses the newest stores instead of keeping them for free.
 */
export function storesWithinLimit<T extends { id: string; createdAt: Date }>(owned: T[], limit: number): Set<string> {
  return new Set([...owned].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id)).slice(0, Math.max(0, limit)).map((s) => s.id));
}

/**
 * Canonical form of an email for trial de-duplication (never used for login):
 * case-insensitive, "+tags" removed, and Gmail's ignored dots removed.
 */
export function normalizeEmail(email: string): string {
  const [rawLocal, rawDomain] = email.trim().toLowerCase().split("@");
  if (!rawLocal || !rawDomain) return email.trim().toLowerCase();
  const domain = rawDomain === "googlemail.com" ? "gmail.com" : rawDomain;
  let local = rawLocal.split("+")[0];
  if (domain === "gmail.com") local = local.replaceAll(".", "");
  return `${local}@${domain}`;
}

/** Common disposable-inbox providers. Not exhaustive by design: card checks are the strong signal. */
const DISPOSABLE = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.info", "guerrillamail.net", "sharklasers.com", "grr.la",
  "10minutemail.com", "10minutemail.net", "temp-mail.org", "temp-mail.io", "tempmail.com", "tempmail.plus", "tempmailo.com",
  "yopmail.com", "yopmail.fr", "yopmail.net", "trashmail.com", "trashmail.de", "getnada.com", "nada.email", "dispostable.com",
  "maildrop.cc", "mailnesia.com", "mintemail.com", "throwawaymail.com", "fakeinbox.com", "mohmal.com", "emailondeck.com",
  "tempr.email", "discard.email", "mailcatch.com", "spamgourmet.com", "moakt.com", "tempinbox.com", "burnermail.io",
  "inboxkitten.com", "1secmail.com", "1secmail.net", "1secmail.org", "mail.tm", "mail.gw", "minuteinbox.com", "emltmp.com",
  "tmpmail.org", "tmpmail.net", "mailpoof.com", "wegwerfmail.de", "byom.de", "spambox.us", "fexpost.com", "tempail.com",
  "dropmail.me", "emailfake.com", "crazymailing.com", "mytemp.email", "tempmailaddress.com", "33mail.com",
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  // Match the domain and its parent domains (e.g. "x.mailinator.com").
  const parts = domain.split(".");
  for (let i = 0; i < parts.length - 1; i++) if (DISPOSABLE.has(parts.slice(i).join("."))) return true;
  return false;
}

export type TrialDenial = "already_used" | "email_used" | "disposable_email" | "network_limit" | "card_used" | "trial_disabled";

/** Decide whether a free trial may be granted. Order matters only for the reported reason. */
export function trialDecision(input: {
  planTrialDays: number;
  trialUsedAt: Date | null;
  email: string;
  emailClaimed: boolean;
  networkClaimsInWindow: number;
}): { trialDays: number; denied?: TrialDenial } {
  if (input.planTrialDays <= 0) return { trialDays: 0, denied: "trial_disabled" };
  if (input.trialUsedAt) return { trialDays: 0, denied: "already_used" };
  if (input.emailClaimed) return { trialDays: 0, denied: "email_used" };
  if (isDisposableEmail(input.email)) return { trialDays: 0, denied: "disposable_email" };
  if (input.networkClaimsInWindow >= NETWORK_TRIAL_LIMIT) return { trialDays: 0, denied: "network_limit" };
  return { trialDays: input.planTrialDays };
}

/** Map Stripe's subscription status to ours. */
export function mapStripeStatus(s: string): BillingState["subscriptionStatus"] {
  switch (s) {
    case "trialing":
      return "TRIALING";
    case "active":
      return "ACTIVE";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    case "incomplete":
      // First payment not completed yet (e.g. 3-D Secure pending): no access until it succeeds.
      return "NONE";
    default:
      // canceled, incomplete_expired, paused
      return "CANCELED";
  }
}
