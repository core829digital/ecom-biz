import "server-only";
import type { Prisma, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getTranslator, type MessageKey } from "@/lib/i18n";
import { emailButton, emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { wantsEmail, type NotificationType } from "@/lib/notification-types";

type Data = Record<string, string | number>;

/** Per type: data fields that contain a code to translate, and the dictionary prefix. */
const TRANSLATED_FIELDS: Record<string, Record<string, string>> = {
  staff_joined: { role: "role." },
  security_2fa_changed: { state: "notify.state." },
};

/** Text for a notification in a given language (titles and bodies take the same params). */
export function renderNotification(n: { type: string; data: unknown }, locale: string) {
  const t = getTranslator(locale);
  const data = { ...((n.data && typeof n.data === "object" ? n.data : {}) as Data) };
  // Fields holding system codes (decided here, never by the data itself) are shown translated.
  for (const [field, prefix] of Object.entries(TRANSLATED_FIELDS[n.type] ?? {})) {
    const v = data[field];
    if (typeof v === "string" && /^[A-Za-z_]+$/.test(v)) data[field] = t(`${prefix}${v}` as MessageKey);
  }
  return {
    title: t(`notify.${n.type}.title` as MessageKey, data),
    body: t(`notify.${n.type}.body` as MessageKey, data),
  };
}

/**
 * Create notifications for the given people and email those who want it. Never throws: a
 * notification must not break the action that triggered it.
 */
export async function notifyUsers(userIds: string[], n: { type: NotificationType; data?: Data; href?: string; storeId?: string | null }) {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (!ids.length) return;
  try {
    await db.notification.createMany({
      data: ids.map((userId) => ({ userId, storeId: n.storeId ?? null, type: n.type, data: (n.data ?? {}) as Prisma.InputJsonValue, href: n.href ?? null })),
    });
    const users = await db.user.findMany({ where: { id: { in: ids } }, select: { email: true, locale: true, notificationPrefs: true } });
    await Promise.allSettled(
      users.filter((u) => wantsEmail(u.notificationPrefs, n.type)).map((u) => {
        const { title, body } = renderNotification({ type: n.type, data: n.data }, u.locale);
        const url = n.href ? `${env.appUrl}${n.href}` : `${env.appUrl}/account/notifications`;
        const t = getTranslator(u.locale);
        return sendEmail({
          to: u.email,
          subject: title,
          text: `${body}\n\n${url}\n\n${t("notify.emailFooter")}`,
          html: emailLayout({ heading: title, bodyHtml: `<p>${escapeHtml(body)}</p>${emailButton(url, t("notify.open"))}`, footer: t("notify.emailFooter") }),
        });
      }),
    );
  } catch (e) {
    console.error("[notifications]", n.type, e);
  }
}

/** Notify a store's team, optionally only some roles. */
export async function notifyStore(storeId: string, n: { type: NotificationType; data?: Data; href?: string }, roles?: Role[]) {
  const members = await db.membership.findMany({ where: { storeId, ...(roles ? { role: { in: roles } } : {}) }, select: { userId: true } }).catch(() => []);
  await notifyUsers(members.map((m) => m.userId), { ...n, storeId });
}

/** Skip if the same kind of notification about the same thing was sent recently (e.g. low stock). */
export async function recentlyNotified(storeId: string, type: NotificationType, key: string, hours = 24) {
  const hit = await db.notification.findFirst({
    where: { storeId, type, createdAt: { gt: new Date(Date.now() - hours * 3600_000) }, data: { path: ["key"], equals: key } },
    select: { id: true },
  });
  return !!hit;
}
