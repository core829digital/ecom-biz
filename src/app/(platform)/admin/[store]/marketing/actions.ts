"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { fail, ok, type ActionState } from "@/lib/action";
import { getPlatformT } from "@/lib/i18n/server";
import { audit } from "@/server/audit";

export async function saveNewsletterSettingsAction(slug: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  await db.store.update({ where: { id: store.id }, data: { newsletterEnabled: fd.get("newsletterEnabled") === "on" } });
  revalidatePath(`/admin/${slug}/marketing`);
  return ok(t("common.saved"));
}

/** Remove a subscriber completely (e.g. on a GDPR erasure request). */
export async function removeSubscriberAction(slug: string, id: string) {
  const { store, user } = await requireStoreAccess(slug, "ADMIN");
  const sub = await db.newsletterSubscriber.findFirst({ where: { id, storeId: store.id } });
  if (!sub) return;
  await db.newsletterSubscriber.delete({ where: { id: sub.id } });
  await audit({ userId: user.id, storeId: store.id, action: "newsletter.remove", target: sub.id });
  revalidatePath(`/admin/${slug}/marketing`);
}

export async function unsubscribeSubscriberAction(slug: string, id: string) {
  const { store } = await requireStoreAccess(slug);
  await db.newsletterSubscriber.updateMany({ where: { id, storeId: store.id }, data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() } });
  revalidatePath(`/admin/${slug}/marketing`);
}

export async function addSubscriberAction(slug: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  const email = z.string().trim().toLowerCase().email().max(200).safeParse(fd.get("email"));
  if (!email.success) return fail(t("validation.fixErrors"), { email: t("validation.email") });
  if (fd.get("consent") !== "on") return fail(t("validation.fixErrors"), { consent: t("newsletter.consentRequired") });
  const { subscribe } = await import("@/server/newsletter");
  await subscribe(store, email.data, "admin");
  revalidatePath(`/admin/${slug}/marketing`);
  return ok(t("newsletter.added"));
}
