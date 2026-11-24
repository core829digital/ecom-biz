"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { fail, ok, type ActionState } from "@/lib/action";
import { getPlatformT } from "@/lib/i18n/server";
import { handleize } from "@/lib/slug";
import { uniqueHandle } from "@/server/catalog";

export async function savePageAction(slug: string, id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store } = await requireStoreAccess(slug);
  const { t } = await getPlatformT();
  const title = String(fd.get("title") ?? "").trim().slice(0, 255);
  if (!title) return fail(t("validation.fixErrors"), { title: t("validation.required") });
  const handleInput = String(fd.get("handle") ?? "").trim();
  const data = {
    title,
    handle: await uniqueHandle(store.id, handleInput ? handleize(handleInput) : title, "page", id ?? undefined),
    body: String(fd.get("body") ?? "").slice(0, 100_000),
    published: fd.get("published") === "on",
    seoTitle: String(fd.get("seoTitle") ?? "").trim().slice(0, 70) || null,
    seoDescription: String(fd.get("seoDescription") ?? "").trim().slice(0, 320) || null,
  };
  if (id) {
    const res = await db.page.updateMany({ where: { id, storeId: store.id }, data });
    if (!res.count) return fail(t("common.notFound"));
    revalidatePath(`/admin/${slug}/online-store/pages`);
    return ok(t("common.saved"));
  }
  const page = await db.page.create({ data: { ...data, storeId: store.id } });
  redirect(`/admin/${slug}/online-store/pages/${page.id}`);
}

export async function deletePageAction(slug: string, id: string) {
  const { store } = await requireStoreAccess(slug, "ADMIN");
  await db.page.deleteMany({ where: { id, storeId: store.id } });
  redirect(`/admin/${slug}/online-store/pages`);
}

/** Create a legal page from the starter template, as a draft the merchant reviews before publishing. */
export async function createLegalPageAction(slug: string, page: string) {
  const { store, user } = await requireStoreAccess(slug, "ADMIN");
  const { STORE_LEGAL_PAGES, storeLegalTemplate } = await import("@/lib/legal/store-templates");
  if (!(STORE_LEGAL_PAGES as readonly string[]).includes(page)) return;
  const existing = await db.page.findUnique({ where: { storeId_handle: { storeId: store.id, handle: page } } });
  if (existing) redirect(`/admin/${slug}/online-store/pages/${existing.id}`);
  const { countryName } = await import("@/lib/geo");
  const address = [store.address1, store.address2, [store.zip, store.city].filter(Boolean).join(" "), countryName(store.countryCode, store.locale)].filter(Boolean).join(", ");
  const missing = store.locale === "it" ? "[DA COMPLETARE]" : "[TO COMPLETE]";
  const tpl = storeLegalTemplate(page as never, store.locale, {
    store: store.name,
    company: store.legalName || store.name,
    address: address || missing,
    vat: store.vatNumber || missing,
    email: store.email,
    phone: store.phone ? ` · ${store.phone}` : "",
  });
  const created = await db.page.create({ data: { storeId: store.id, handle: page, title: tpl.title, body: tpl.body, published: false } });
  const { audit } = await import("@/server/audit");
  await audit({ userId: user.id, storeId: store.id, action: "page.legal_template", target: page });
  revalidatePath(`/admin/${slug}/online-store/pages`);
  redirect(`/admin/${slug}/online-store/pages/${created.id}`);
}
