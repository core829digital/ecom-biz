"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { fail, formObject, ok, parseForm, type ActionState } from "@/lib/action";
import { getPlatformT } from "@/lib/i18n/server";
import { parseMoney } from "@/lib/money";
import { checkVatNumber } from "@/lib/vat-id";
import { countryName } from "@/lib/geo";
import { audit } from "@/server/audit";
import { assertCanAddProducts, PlanLimitError } from "@/server/plans";
import { uniqueHandle } from "@/server/catalog";

/**
 * Guided setup: one narrow action per step, each validating only its own fields and writing
 * the same data the regular settings pages use (nothing to keep in sync).
 */
const done = (slug: string) => { revalidatePath(`/admin/${slug}`, "layout"); };
const bool = (v: FormDataEntryValue | null) => v === "on" || v === "true";

export async function setupBusinessAction(slug: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  const parsed = parseForm(z.object({
    legalName: z.string().trim().min(2, t("validation.required")).max(160),
    vatNumber: z.string().trim().min(2, t("validation.required")).max(40),
    address1: z.string().trim().min(3, t("validation.required")).max(200),
    city: z.string().trim().min(1, t("validation.required")).max(100),
    zip: z.string().trim().min(2, t("validation.required")).max(20),
    province: z.string().trim().max(100),
    phone: z.string().trim().max(40),
    email: z.string().trim().toLowerCase().email(t("validation.email")),
  }), formObject(fd));
  if (parsed.fieldErrors) return fail(t("validation.fixErrors"), parsed.fieldErrors);
  const d = parsed.data;
  const vat = checkVatNumber(d.vatNumber, store.countryCode);
  if (!vat.ok) return fail(t("validation.fixErrors"), { vatNumber: t(vat.reason === "checksum" ? "setup.vat.checksum" : "setup.vat.format") });
  await db.store.update({ where: { id: store.id }, data: { legalName: d.legalName, vatNumber: vat.normalized, address1: d.address1, city: d.city, zip: d.zip, province: d.province || null, phone: d.phone || null, email: d.email } });
  done(slug);
  return ok(t("common.saved"));
}

export async function setupTaxesAction(slug: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  const rate = parseFloat(String(fd.get("rate") ?? "").replace(",", "."));
  if (!Number.isFinite(rate) || rate < 0 || rate > 40) return fail(t("validation.fixErrors"), { rate: t("setup.taxes.rateInvalid") });
  const bps = Math.round(rate * 100);
  const existing = await db.taxRate.findFirst({ where: { storeId: store.id, countryCode: store.countryCode } });
  await db.$transaction([
    db.store.update({ where: { id: store.id }, data: { taxesIncluded: bool(fd.get("taxesIncluded")), taxShipping: bool(fd.get("taxShipping")) } }),
    existing
      ? db.taxRate.update({ where: { id: existing.id }, data: { rateBps: bps } })
      : db.taxRate.create({ data: { storeId: store.id, countryCode: store.countryCode, name: "VAT", rateBps: bps } }),
  ]);
  done(slug);
  return ok(t("common.saved"));
}

export async function setupPaymentsAction(slug: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store, user } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  const cod = bool(fd.get("cod"));
  const bank = bool(fd.get("bank"));
  const holder = String(fd.get("holder") ?? "").trim().slice(0, 120);
  const iban = String(fd.get("iban") ?? "").toUpperCase().replace(/\s/g, "").slice(0, 34);
  const errors: Record<string, string> = {};
  if (bank && !holder) errors.holder = t("validation.required");
  if (bank && !/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) errors.iban = t("setup.payments.ibanInvalid");
  if (Object.keys(errors).length) return fail(t("validation.fixErrors"), errors);
  const it = store.locale === "it";
  const instructions = bank
    ? (it ? `Intestatario: ${holder}\nIBAN: ${iban.replace(/(.{4})/g, "$1 ").trim()}\nCausale: numero d'ordine\nL'ordine viene spedito alla ricezione del pagamento.` : `Account holder: ${holder}\nIBAN: ${iban.replace(/(.{4})/g, "$1 ").trim()}\nReference: your order number\nWe ship as soon as the payment arrives.`)
    : "";
  await db.store.update({
    where: { id: store.id },
    data: { manualPayments: { cod: { enabled: cod, instructions: cod ? (it ? "Paghi in contanti al corriere alla consegna." : "Pay the courier in cash on delivery.") : "" }, bankTransfer: { enabled: bank, instructions } } },
  });
  await audit({ userId: user.id, storeId: store.id, action: "settings.payments", meta: { cod, bankTransfer: bank } });
  done(slug);
  return ok(t("common.saved"));
}

/** One domestic price, plus optional free shipping above a threshold. Replaces the domestic zone's rates. */
export async function setupShippingAction(slug: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  const price = parseMoney(String(fd.get("price") ?? ""));
  const freeRaw = String(fd.get("freeOver") ?? "").trim();
  const freeOver = freeRaw ? parseMoney(freeRaw) : null;
  const errors: Record<string, string> = {};
  if (price === null) errors.price = t("products.error.price");
  if (freeRaw && (freeOver === null || freeOver <= 0)) errors.freeOver = t("products.error.price");
  if (Object.keys(errors).length) return fail(t("validation.fixErrors"), errors);
  const it = store.locale === "it";
  const zone = (await db.shippingZone.findFirst({ where: { storeId: store.id, countries: { has: store.countryCode } }, orderBy: { id: "asc" } }))
    ?? (await db.shippingZone.create({ data: { storeId: store.id, name: countryName(store.countryCode, store.locale), countries: [store.countryCode] } }));
  await db.$transaction([
    db.shippingRate.deleteMany({ where: { zoneId: zone.id } }),
    db.shippingRate.create({ data: { zoneId: zone.id, name: it ? "Spedizione standard" : "Standard shipping", priceCents: price!, maxSubtotalCents: freeOver !== null && price! > 0 ? freeOver - 1 : null } }),
    ...(freeOver !== null && price! > 0 ? [db.shippingRate.create({ data: { zoneId: zone.id, name: it ? "Spedizione gratuita" : "Free shipping", priceCents: 0, minSubtotalCents: freeOver } })] : []),
  ]);
  done(slug);
  return ok(t("common.saved"));
}

/** Creates the four legal pages from the templates with the store's data, published when complete. */
export async function setupLegalAction(slug: string, _: ActionState): Promise<ActionState> {
  const { store, user } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  const { STORE_LEGAL_PAGES, storeLegalTemplate } = await import("@/lib/legal/store-templates");
  const address = [store.address1, store.address2, [store.zip, store.city].filter(Boolean).join(" "), countryName(store.countryCode, store.locale)].filter(Boolean).join(", ");
  const complete = !!(store.legalName && store.vatNumber && store.address1);
  const missing = store.locale === "it" ? "[DA COMPLETARE]" : "[TO COMPLETE]";
  for (const page of STORE_LEGAL_PAGES) {
    if (await db.page.findUnique({ where: { storeId_handle: { storeId: store.id, handle: page } } })) continue;
    const tpl = storeLegalTemplate(page, store.locale, {
      store: store.name, company: store.legalName || store.name, address: address || missing, vat: store.vatNumber || missing, email: store.email, phone: store.phone ? ` · ${store.phone}` : "",
    });
    await db.page.create({ data: { storeId: store.id, handle: page, title: tpl.title, body: tpl.body, published: complete } });
  }
  await audit({ userId: user.id, storeId: store.id, action: "page.legal_template", target: "all" });
  done(slug);
  return complete ? ok(t("setup.legal.published")) : ok(t("setup.legal.drafts"));
}

export async function setupProductAction(slug: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store, user } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  const title = String(fd.get("title") ?? "").trim().slice(0, 150);
  const price = parseMoney(String(fd.get("price") ?? ""));
  const stock = Math.max(0, Math.min(100000, parseInt(String(fd.get("stock") ?? "0"), 10) || 0));
  const imageUrl = String(fd.get("imageUrl") ?? "");
  const errors: Record<string, string> = {};
  if (!title) errors.title = t("validation.required");
  if (price === null) errors.price = t("products.error.price");
  if (Object.keys(errors).length) return fail(t("validation.fixErrors"), errors);
  if (imageUrl && !(await db.storedFile.findFirst({ where: { storeId: store.id, url: imageUrl } }))) return fail(t("products.error.image"));
  try {
    await assertCanAddProducts(store.id);
  } catch (e) {
    if (e instanceof PlanLimitError) return fail(t("usage.limitProductsDetail", { count: e.limit ?? 0 }));
    throw e;
  }
  const product = await db.product.create({
    data: {
      storeId: store.id, title, handle: await uniqueHandle(store.id, title, "product"), description: String(fd.get("description") ?? "").slice(0, 5000), status: "ACTIVE", publishedAt: new Date(),
      variants: { create: [{ title: "Default", priceCents: price!, inventoryQty: stock }] },
      ...(imageUrl ? { images: { create: [{ url: imageUrl, alt: title }] } } : {}),
    },
  });
  await audit({ userId: user.id, storeId: store.id, action: "product.create", target: product.title });
  done(slug);
  return ok(t("common.saved"));
}
