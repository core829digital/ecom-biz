"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth/staff";
import { fail, ok, type ActionState } from "@/lib/action";
import { getPlatformT } from "@/lib/i18n/server";
import { parseMoney } from "@/lib/money";
import { CURRENCIES } from "@/lib/geo";
import { getStripe } from "@/lib/stripe";
import { ensurePlanPrice } from "@/server/billing";

export async function setStoreStatusAction(storeId: string, status: "ACTIVE" | "SUSPENDED") {
  await requirePlatformAdmin();
  await db.store.update({ where: { id: storeId }, data: { status } });
  revalidatePath(`/platform/stores/${storeId}`);
}

export async function updateStoreBillingAction(storeId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const { t } = await getPlatformT();
  const planId = String(fd.get("planId") ?? "") || null;
  const feeRaw = String(fd.get("feePct") ?? "").trim().replace(",", ".");
  const fee = feeRaw === "" ? null : Math.round(parseFloat(feeRaw) * 100);
  if (fee !== null && (!Number.isFinite(fee) || fee < 0 || fee > 5000)) return fail(t("validation.fixErrors"), { feePct: t("platform.error.fee") });
  const extend = parseInt(String(fd.get("extendTrialDays") ?? "0"), 10) || 0;
  const store = await db.store.findUniqueOrThrow({ where: { id: storeId } });
  if (planId && !(await db.plan.findUnique({ where: { id: planId } }))) return fail(t("products.error.invalid"));
  const base = store.trialEndsAt && store.trialEndsAt > new Date() ? store.trialEndsAt : new Date();
  await db.store.update({
    where: { id: storeId },
    data: {
      planId,
      platformFeeBps: fee,
      ...(extend > 0 ? { trialEndsAt: new Date(base.getTime() + Math.min(extend, 365) * 86400_000), subscriptionStatus: store.subscriptionStatus === "ACTIVE" ? "ACTIVE" : "TRIALING" } : {}),
    },
  });
  revalidatePath(`/platform/stores/${storeId}`);
  return ok(t("common.saved"));
}

export async function savePlanAction(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const { t } = await getPlatformT();
  const get = (k: string) => String(fd.get(k) ?? "").trim();
  const fieldErrors: Record<string, string> = {};
  const name = get("name").slice(0, 60);
  if (!name) fieldErrors.name = t("validation.required");
  const price = parseMoney(get("price"));
  if (price === null) fieldErrors.price = t("products.error.price");
  const currency = get("currency");
  if (!CURRENCIES.includes(currency)) fieldErrors.currency = t("products.error.invalid");
  const interval = get("interval") === "year" ? "year" : "month";
  const feePct = parseFloat(get("feePct").replace(",", ".") || "0");
  if (!Number.isFinite(feePct) || feePct < 0 || feePct > 50) fieldErrors.feePct = t("platform.error.fee");
  const trialDays = parseInt(get("trialDays") || "0", 10);
  if (!Number.isInteger(trialDays) || trialDays < 0 || trialDays > 365) fieldErrors.trialDays = t("products.error.invalid");
  if (Object.keys(fieldErrors).length) return fail(t("validation.fixErrors"), fieldErrors);
  const data = {
    name,
    priceCents: price!,
    currency,
    interval,
    transactionFeeBps: Math.round(feePct * 100),
    trialDays,
    features: get("features").split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 20),
    active: fd.get("active") === "on",
    position: parseInt(get("position") || "0", 10) || 0,
  };
  let plan;
  if (id) {
    const prev = await db.plan.findUniqueOrThrow({ where: { id } });
    // Stripe prices are immutable: a new amount/currency/interval needs a new Price.
    const priceChanged = prev.priceCents !== data.priceCents || prev.currency !== data.currency || prev.interval !== data.interval;
    plan = await db.plan.update({ where: { id }, data: { ...data, ...(priceChanged ? { stripePriceId: null } : {}) } });
  } else {
    plan = await db.plan.create({ data });
  }
  if (getStripe() && plan.priceCents > 0) {
    try {
      await ensurePlanPrice(plan);
    } catch (e) {
      console.error("[plans] stripe sync", e);
      return fail(t("platform.error.stripeSync"));
    }
  }
  revalidatePath("/platform/plans");
  if (!id) redirect("/platform/plans");
  return ok(t("common.saved"));
}

export async function togglePlatformAdminAction(userId: string) {
  const me = await requirePlatformAdmin();
  if (me.id === userId) return; // never lock yourself out
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  await db.user.update({ where: { id: userId }, data: { isPlatformAdmin: !user.isPlatformAdmin } });
  revalidatePath("/platform/users");
}
