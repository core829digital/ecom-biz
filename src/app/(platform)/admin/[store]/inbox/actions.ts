"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { ok, type ActionState } from "@/lib/action";
import { getPlatformT } from "@/lib/i18n/server";

export async function deleteMessageAction(slug: string, id: string) {
  const { store } = await requireStoreAccess(slug);
  await db.contactMessage.deleteMany({ where: { id, storeId: store.id } });
  revalidatePath(`/admin/${slug}`, "layout");
  redirect(`/admin/${slug}/inbox`);
}

export async function markUnreadAction(slug: string, id: string) {
  const { store } = await requireStoreAccess(slug);
  await db.contactMessage.updateMany({ where: { id, storeId: store.id }, data: { readAt: null } });
  revalidatePath(`/admin/${slug}`, "layout");
  redirect(`/admin/${slug}/inbox`);
}

export async function saveContactSettingsAction(slug: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  await db.store.update({ where: { id: store.id }, data: { contactEnabled: fd.get("contactEnabled") === "on" } });
  revalidatePath(`/admin/${slug}/inbox`);
  return ok(t("common.saved"));
}
