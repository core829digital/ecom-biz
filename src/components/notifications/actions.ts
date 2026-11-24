"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser, requireUser } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { ok, type ActionState } from "@/lib/action";
import { isNotificationType, NOTIFICATION_TYPES, type NotificationPrefs } from "@/lib/notification-types";
import { renderNotification } from "@/server/notifications";

export type NotificationItem = { id: string; type: string; title: string; body: string; href: string | null; read: boolean; createdAt: string; store: string | null };

/** Latest notifications for the bell, rendered in the viewer's language. Only ever the viewer's own. */
export async function listNotificationsAction(): Promise<{ items: NotificationItem[]; unread: number }> {
  const user = await getCurrentUser();
  if (!user) return { items: [], unread: 0 };
  const { locale } = await getPlatformT();
  const [rows, unread] = await Promise.all([
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20, include: { store: { select: { name: true } } } }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  return {
    unread,
    items: rows.map((n) => ({ id: n.id, type: n.type, ...renderNotification(n, locale), href: n.href, read: !!n.readAt, createdAt: n.createdAt.toISOString(), store: n.store?.name ?? null })),
  };
}

export async function unreadCountAction(): Promise<number> {
  const user = await getCurrentUser();
  return user ? db.notification.count({ where: { userId: user.id, readAt: null } }) : 0;
}

export async function markReadAction(id: string) {
  const user = await requireUser();
  await db.notification.updateMany({ where: { id, userId: user.id, readAt: null }, data: { readAt: new Date() } });
}

export async function markAllReadAction() {
  const user = await requireUser();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/account/notifications");
}

export async function saveNotificationPrefsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const { t } = await getPlatformT();
  const prefs: NotificationPrefs = {};
  for (const type of Object.keys(NOTIFICATION_TYPES)) {
    if (isNotificationType(type)) prefs[type] = { email: fd.get(`email:${type}`) === "on" };
  }
  await db.user.update({ where: { id: user.id }, data: { notificationPrefs: prefs as Prisma.InputJsonValue } });
  revalidatePath("/account/notifications");
  return ok(t("common.saved"));
}
