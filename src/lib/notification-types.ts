/**
 * Notification catalogue: every type, who can switch its email on/off, and its default.
 * Texts live in the i18n dictionaries as `notify.<type>.title` / `notify.<type>.body`.
 */
export const NOTIFICATION_TYPES = {
  // Store events (sent to the store's team)
  order_new: { group: "store", email: false },
  low_stock: { group: "store", email: false },
  review_pending: { group: "store", email: false },
  order_dispute: { group: "store", email: true },
  webhook_failed: { group: "store", email: true },
  staff_joined: { group: "store", email: false },
  contact_message: { group: "store", email: false }, // the message itself is already emailed to the store address
  // Account and billing (sent to the account owner; billing emails are already sent separately)
  billing_trial_ending: { group: "billing", email: false, emailAlways: true },
  billing_payment_failed: { group: "billing", email: false, emailAlways: true },
  billing_hold: { group: "billing", email: false, emailAlways: true },
  // Security (email on by default)
  security_new_login: { group: "security", email: true },
  security_2fa_changed: { group: "security", email: true },
} as const;

export type NotificationType = keyof typeof NOTIFICATION_TYPES;
export const NOTIFICATION_GROUPS = ["store", "billing", "security"] as const;

export type NotificationPrefs = Partial<Record<NotificationType, { email?: boolean }>>;

/** Types whose email is sent by its own flow regardless of preferences (no toggle, no duplicate). */
export function emailAlways(type: NotificationType): boolean {
  return "emailAlways" in NOTIFICATION_TYPES[type];
}

export function wantsEmail(prefs: unknown, type: NotificationType): boolean {
  if (emailAlways(type)) return false;
  const p = (prefs && typeof prefs === "object" ? (prefs as NotificationPrefs)[type] : undefined) ?? {};
  return typeof p.email === "boolean" ? p.email : NOTIFICATION_TYPES[type].email;
}

export function isNotificationType(t: string): t is NotificationType {
  return Object.prototype.hasOwnProperty.call(NOTIFICATION_TYPES, t);
}
