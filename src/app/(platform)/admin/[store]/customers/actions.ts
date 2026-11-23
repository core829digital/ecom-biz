"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { fail, formObject, ok, parseForm, type ActionState } from "@/lib/action";
import { getPlatformT } from "@/lib/i18n/server";
import { emitWebhook } from "@/server/webhooks";

export async function saveCustomerAction(slug: string, id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store } = await requireStoreAccess(slug);
  const { t } = await getPlatformT();
  const schema = z.object({
    email: z.string().trim().toLowerCase().email(t("validation.email")),
    firstName: z.string().trim().max(80),
    lastName: z.string().trim().max(80),
    phone: z.string().trim().max(40),
    note: z.string().max(2000),
    tags: z.string().max(1000),
  });
  const parsed = parseForm(schema, { note: "", tags: "", phone: "", firstName: "", lastName: "", ...formObject(fd) });
  if (parsed.fieldErrors) return fail(t("validation.fixErrors"), parsed.fieldErrors);
  const d = parsed.data;
  const data = {
    email: d.email,
    firstName: d.firstName || null,
    lastName: d.lastName || null,
    phone: d.phone || null,
    note: d.note || null,
    tags: [...new Set(d.tags.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, 50),
    acceptsMarketing: fd.get("acceptsMarketing") === "on",
  };
  const clash = await db.customer.findFirst({ where: { storeId: store.id, email: d.email, ...(id ? { NOT: { id } } : {}) } });
  if (clash) return fail(t("validation.fixErrors"), { email: t("customers.emailTaken") });
  if (id) {
    const res = await db.customer.updateMany({ where: { id, storeId: store.id }, data });
    if (!res.count) return fail(t("common.notFound"));
    await emitWebhook(store.id, "customers/update", { id, email: d.email });
    revalidatePath(`/admin/${slug}/customers/${id}`);
    return ok(t("common.saved"));
  }
  const customer = await db.customer.create({ data: { ...data, storeId: store.id } });
  await emitWebhook(store.id, "customers/create", { id: customer.id, email: customer.email });
  redirect(`/admin/${slug}/customers/${customer.id}`);
}

export async function deleteCustomerAction(slug: string, id: string) {
  const { store } = await requireStoreAccess(slug, "ADMIN");
  // Orders keep their own copy of contact details; the link is set to null.
  await db.customer.deleteMany({ where: { id, storeId: store.id } });
  revalidatePath(`/admin/${slug}/customers`);
  redirect(`/admin/${slug}/customers`);
}
