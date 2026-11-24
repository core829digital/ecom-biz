"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { fail, formObject, ok, parseForm, type ActionState } from "@/lib/action";
import { getPlatformT } from "@/lib/i18n/server";
import { COUNTRY_CODES, CURRENCIES } from "@/lib/geo";
import { parseMoney } from "@/lib/money";
import { getStripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { audit } from "@/server/audit";

const bool = (v: unknown) => v === "on" || v === "true";

// ── General ───────────────────────────────────────────────
export async function saveGeneralAction(slug: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  const schema = z.object({
    name: z.string().trim().min(1, t("validation.required")).max(80),
    email: z.string().trim().toLowerCase().email(t("validation.email")),
    phone: z.string().trim().max(40),
    legalName: z.string().trim().max(160),
    vatNumber: z.string().trim().max(40),
    address1: z.string().trim().max(200),
    address2: z.string().trim().max(200),
    city: z.string().trim().max(100),
    zip: z.string().trim().max(20),
    province: z.string().trim().max(100),
    countryCode: z.string().refine((c) => COUNTRY_CODES.includes(c)),
    currency: z.enum(CURRENCIES as [string, ...string[]]),
    locale: z.enum(["en", "it"]),
    timezone: z.string().trim().max(60),
    seoTitle: z.string().trim().max(70),
    seoDescription: z.string().trim().max(320),
    socialImageUrl: z.string().trim().max(2048).optional().default(""),
  });
  const parsed = parseForm(schema, formObject(fd));
  if (parsed.fieldErrors) return fail(t("validation.fixErrors"), parsed.fieldErrors);
  const d = parsed.data;
  try {
    new Intl.DateTimeFormat("en", { timeZone: d.timezone });
  } catch {
    return fail(t("validation.fixErrors"), { timezone: t("settings.general.timezoneInvalid") });
  }
  if (d.currency !== store.currency && (await db.order.count({ where: { storeId: store.id } })) > 0) {
    return fail(t("validation.fixErrors"), { currency: t("settings.general.currencyLocked") });
  }
  const nullable = (v: string) => v || null;
  if (d.socialImageUrl && !d.socialImageUrl.startsWith("/files/")) {
    const { isPublicHttpsUrl } = await import("@/lib/url-safety");
    if (!(await isPublicHttpsUrl(d.socialImageUrl))) return fail(t("validation.fixErrors"), { socialImageUrl: t("blog.error.cover") });
  }
  await db.store.update({
    where: { id: store.id },
    data: {
      name: d.name, email: d.email, phone: nullable(d.phone), legalName: nullable(d.legalName), vatNumber: nullable(d.vatNumber),
      address1: nullable(d.address1), address2: nullable(d.address2), city: nullable(d.city), zip: nullable(d.zip), province: nullable(d.province),
      countryCode: d.countryCode, currency: d.currency, locale: d.locale, timezone: d.timezone || "UTC",
      seoTitle: nullable(d.seoTitle), seoDescription: nullable(d.seoDescription), socialImageUrl: nullable(d.socialImageUrl),
    },
  });
  revalidatePath(`/admin/${slug}`, "layout");
  return ok(t("common.saved"));
}

// ── Payments ──────────────────────────────────────────────
export async function connectStripeAction(slug: string) {
  const { store, user } = await requireStoreAccess(slug, "OWNER");
  await audit({ userId: user.id, storeId: store.id, action: "settings.stripe_connect" });
  const stripe = getStripe();
  if (!stripe) redirect(`/admin/${slug}/settings/payments?error=stripe`);
  let accountId = store.stripeAccountId;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: store.countryCode,
      email: store.email,
      business_profile: { name: store.name },
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      metadata: { storeId: store.id },
    });
    accountId = account.id;
    await db.store.update({ where: { id: store.id }, data: { stripeAccountId: accountId } });
  }
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${env.appUrl}/admin/${slug}/settings/payments?stripe=refresh`,
    return_url: `${env.appUrl}/admin/${slug}/settings/payments?stripe=return`,
  });
  redirect(link.url);
}

export async function stripeDashboardAction(slug: string) {
  const { store } = await requireStoreAccess(slug, "OWNER");
  const stripe = getStripe();
  if (!stripe || !store.stripeAccountId) redirect(`/admin/${slug}/settings/payments`);
  const link = await stripe.accounts.createLoginLink(store.stripeAccountId);
  redirect(link.url);
}

export async function saveManualPaymentsAction(slug: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store, user } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  const manualPayments = {
    cod: { enabled: bool(fd.get("codEnabled")), instructions: String(fd.get("codInstructions") ?? "").slice(0, 2000) },
    bankTransfer: { enabled: bool(fd.get("bankEnabled")), instructions: String(fd.get("bankInstructions") ?? "").slice(0, 2000) },
  };
  if (manualPayments.bankTransfer.enabled && !manualPayments.bankTransfer.instructions.trim()) {
    return fail(t("validation.fixErrors"), { bankInstructions: t("settings.payments.bankInstructionsRequired") });
  }
  await db.store.update({ where: { id: store.id }, data: { manualPayments } });
  await audit({ userId: user.id, storeId: store.id, action: "settings.payments", meta: { cod: manualPayments.cod.enabled, bankTransfer: manualPayments.bankTransfer.enabled } });
  revalidatePath(`/admin/${slug}/settings/payments`);
  return ok(t("common.saved"));
}

// ── Shipping ──────────────────────────────────────────────
function parseCountries(fd: FormData): string[] {
  const list = fd.getAll("countries").map(String);
  if (list.includes("*")) return ["*"];
  return [...new Set(list.filter((c) => COUNTRY_CODES.includes(c)))];
}

export async function saveZoneAction(slug: string, zoneId: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  const name = String(fd.get("name") ?? "").trim().slice(0, 80);
  const countries = parseCountries(fd);
  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = t("validation.required");
  if (!countries.length) fieldErrors.countries = t("settings.shipping.chooseCountries");
  if (Object.keys(fieldErrors).length) return fail(t("validation.fixErrors"), fieldErrors);
  if (zoneId) {
    const zone = await db.shippingZone.findFirst({ where: { id: zoneId, storeId: store.id } });
    if (!zone) return fail(t("common.notFound"));
    await db.shippingZone.update({ where: { id: zone.id }, data: { name, countries } });
    revalidatePath(`/admin/${slug}/settings/shipping`);
    return ok(t("common.saved"));
  }
  const zone = await db.shippingZone.create({ data: { storeId: store.id, name, countries } });
  redirect(`/admin/${slug}/settings/shipping/${zone.id}`);
}

export async function deleteZoneAction(slug: string, zoneId: string) {
  const { store } = await requireStoreAccess(slug, "ADMIN");
  await db.shippingZone.deleteMany({ where: { id: zoneId, storeId: store.id } });
  revalidatePath(`/admin/${slug}/settings/shipping`);
  redirect(`/admin/${slug}/settings/shipping`);
}

export async function addRateAction(slug: string, zoneId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  const zone = await db.shippingZone.findFirst({ where: { id: zoneId, storeId: store.id } });
  if (!zone) return fail(t("common.notFound"));
  const name = String(fd.get("name") ?? "").trim().slice(0, 80);
  const price = parseMoney(String(fd.get("price") ?? ""));
  const minRaw = String(fd.get("min") ?? "").trim();
  const maxRaw = String(fd.get("max") ?? "").trim();
  const min = minRaw ? parseMoney(minRaw) : null;
  const max = maxRaw ? parseMoney(maxRaw) : null;
  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = t("validation.required");
  if (price === null) fieldErrors.price = t("products.error.price");
  if (minRaw && min === null) fieldErrors.min = t("products.error.price");
  if (maxRaw && max === null) fieldErrors.max = t("products.error.price");
  if (min !== null && max !== null && max < min) fieldErrors.max = t("settings.shipping.maxBelowMin");
  if (Object.keys(fieldErrors).length) return fail(t("validation.fixErrors"), fieldErrors);
  await db.shippingRate.create({ data: { zoneId: zone.id, name, priceCents: price!, minSubtotalCents: min, maxSubtotalCents: max } });
  revalidatePath(`/admin/${slug}/settings/shipping/${zone.id}`);
  return ok(t("common.saved"));
}

export async function deleteRateAction(slug: string, zoneId: string, rateId: string) {
  const { store } = await requireStoreAccess(slug, "ADMIN");
  await db.shippingRate.deleteMany({ where: { id: rateId, zone: { id: zoneId, storeId: store.id } } });
  revalidatePath(`/admin/${slug}/settings/shipping/${zoneId}`);
}

// ── Taxes ─────────────────────────────────────────────────
export async function saveTaxSettingsAction(slug: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  await db.store.update({ where: { id: store.id }, data: { taxesIncluded: bool(fd.get("taxesIncluded")), taxShipping: bool(fd.get("taxShipping")) } });
  revalidatePath(`/admin/${slug}/settings/taxes`);
  return ok(t("common.saved"));
}

export async function saveTaxRateAction(slug: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  const countryCode = String(fd.get("countryCode") ?? "");
  const name = String(fd.get("name") ?? "").trim().slice(0, 40) || "VAT";
  const pct = parseFloat(String(fd.get("rate") ?? "").replace(",", "."));
  const fieldErrors: Record<string, string> = {};
  if (!COUNTRY_CODES.includes(countryCode)) fieldErrors.countryCode = t("validation.required");
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) fieldErrors.rate = t("settings.taxes.rateInvalid");
  if (Object.keys(fieldErrors).length) return fail(t("validation.fixErrors"), fieldErrors);
  const rateBps = Math.round(pct * 100);
  await db.taxRate.upsert({
    where: { storeId_countryCode: { storeId: store.id, countryCode } },
    create: { storeId: store.id, countryCode, name, rateBps },
    update: { name, rateBps },
  });
  revalidatePath(`/admin/${slug}/settings/taxes`);
  return ok(t("common.saved"));
}

export async function deleteTaxRateAction(slug: string, id: string) {
  const { store } = await requireStoreAccess(slug, "ADMIN");
  await db.taxRate.deleteMany({ where: { id, storeId: store.id } });
  revalidatePath(`/admin/${slug}/settings/taxes`);
}

// ── Checkout ──────────────────────────────────────────────
export async function saveCheckoutSettingsAction(slug: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  await db.store.update({ where: { id: store.id }, data: { checkoutRequirePhone: bool(fd.get("requirePhone")), abandonedCartEmails: bool(fd.get("abandonedCartEmails")) } });
  revalidatePath(`/admin/${slug}/settings/checkout`);
  return ok(t("common.saved"));
}
