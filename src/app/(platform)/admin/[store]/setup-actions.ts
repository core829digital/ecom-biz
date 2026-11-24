"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";

export async function dismissSetupAction(slug: string) {
  const { store } = await requireStoreAccess(slug);
  await db.store.update({ where: { id: store.id }, data: { setupDismissedAt: new Date() } });
  revalidatePath(`/admin/${slug}`);
}

export async function restoreSetupAction(slug: string) {
  const { store } = await requireStoreAccess(slug);
  await db.store.update({ where: { id: store.id }, data: { setupDismissedAt: null } });
  revalidatePath(`/admin/${slug}`);
}
