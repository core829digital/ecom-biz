"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { fail, ok, type ActionState } from "@/lib/action";
import { getPlatformT } from "@/lib/i18n/server";
import { parseMoney } from "@/lib/money";
import { normalizeCode } from "@/server/discounts";
import { fromZonedInput } from "@/lib/dates";

export async function saveDiscountAction(slug: string, id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  const get = (k: string) => String(fd.get(k) ?? "").trim();
  const fieldErrors: Record<string, string> = {};

  const code = normalizeCode(get("code"));
  if (!/^[A-Z0-9_-]{3,40}$/.test(code)) fieldErrors.code = t("discounts.error.code");
  const type = get("type");
  if (!["PERCENTAGE", "FIXED_AMOUNT", "FREE_SHIPPING"].includes(type)) fieldErrors.type = t("products.error.invalid");

  let value = 0;
  if (type === "PERCENTAGE") {
    const pct = parseFloat(get("value").replace(",", "."));
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) fieldErrors.value = t("discounts.error.percent");
    else value = Math.round(pct * 100);
  } else if (type === "FIXED_AMOUNT") {
    const cents = parseMoney(get("value"));
    if (!cents) fieldErrors.value = t("products.error.price");
    else value = cents;
  }
  const minRaw = get("minSubtotal");
  const minSubtotalCents = minRaw ? parseMoney(minRaw) : 0;
  if (minSubtotalCents === null) fieldErrors.minSubtotal = t("products.error.price");
  const limitRaw = get("usageLimit");
  const usageLimit = limitRaw ? parseInt(limitRaw, 10) : null;
  if (limitRaw && (!Number.isInteger(usageLimit) || usageLimit! < 1)) fieldErrors.usageLimit = t("products.error.invalid");

  const parseDate = (s: string) => (s ? fromZonedInput(s, store.timezone) ?? new Date(NaN) : null);
  const startsAt = parseDate(get("startsAt")) ?? new Date();
  const endsAt = parseDate(get("endsAt"));
  if (isNaN(startsAt.getTime())) fieldErrors.startsAt = t("products.error.invalid");
  if (endsAt && (isNaN(endsAt.getTime()) || endsAt <= startsAt)) fieldErrors.endsAt = t("discounts.error.endBeforeStart");

  if (Object.keys(fieldErrors).length) return fail(t("validation.fixErrors"), fieldErrors);
  const clash = await db.discount.findFirst({ where: { storeId: store.id, code, ...(id ? { NOT: { id } } : {}) } });
  if (clash) return fail(t("validation.fixErrors"), { code: t("discounts.error.taken") });

  const data = {
    code,
    type: type as "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING",
    value,
    minSubtotalCents: minSubtotalCents ?? 0,
    usageLimit,
    oncePerCustomer: fd.get("oncePerCustomer") === "on",
    startsAt,
    endsAt,
    active: fd.get("active") === "on",
  };
  if (id) {
    const res = await db.discount.updateMany({ where: { id, storeId: store.id }, data });
    if (!res.count) return fail(t("common.notFound"));
    revalidatePath(`/admin/${slug}/discounts`);
    return ok(t("common.saved"));
  }
  await db.discount.create({ data: { ...data, storeId: store.id } });
  revalidatePath(`/admin/${slug}/discounts`);
  redirect(`/admin/${slug}/discounts`);
}

export async function deleteDiscountAction(slug: string, id: string) {
  const { store } = await requireStoreAccess(slug, "ADMIN");
  await db.discount.deleteMany({ where: { id, storeId: store.id } });
  revalidatePath(`/admin/${slug}/discounts`);
  redirect(`/admin/${slug}/discounts`);
}
