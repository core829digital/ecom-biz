"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { fail, ok, type ActionState } from "@/lib/action";
import { getPlatformT } from "@/lib/i18n/server";
import { parseMoney } from "@/lib/money";
import { addOrderEvent, cancelOrder, fulfillOrder, markOrderPaid, OrderActionError, refundOrder } from "@/server/order-admin";
import type { Translator } from "@/lib/i18n";
import { audit } from "@/server/audit";

const bool = (v: FormDataEntryValue | null) => v === "on" || v === "true";

function lineQuantities(fd: FormData) {
  const out: { lineId: string; quantity: number }[] = [];
  for (const [k, v] of fd.entries()) {
    if (!k.startsWith("qty:")) continue;
    const quantity = Math.floor(Number(v));
    if (Number.isFinite(quantity) && quantity > 0) out.push({ lineId: k.slice(4), quantity });
  }
  return out;
}

function errorMessage(t: Translator, e: unknown): string {
  if (e instanceof OrderActionError) return t(`orders.error.${e.code}`);
  console.error("[orders]", e);
  return t("orders.error.provider");
}

export async function fulfillAction(slug: string, orderId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store, user } = await requireStoreAccess(slug);
  const { t } = await getPlatformT();
  try {
    await fulfillOrder(store, orderId, {
      lines: lineQuantities(fd),
      trackingCompany: String(fd.get("trackingCompany") ?? "").trim().slice(0, 80),
      trackingNumber: String(fd.get("trackingNumber") ?? "").trim().slice(0, 120),
      trackingUrl: String(fd.get("trackingUrl") ?? "").trim().slice(0, 500),
      notify: bool(fd.get("notify")),
      author: user.name,
    });
  } catch (e) {
    return fail(errorMessage(t, e));
  }
  revalidatePath(`/admin/${slug}/orders`);
  redirect(`/admin/${slug}/orders/${orderId}`);
}

export async function markPaidAction(slug: string, orderId: string) {
  const { store, user } = await requireStoreAccess(slug);
  try {
    await markOrderPaid(store, orderId, user.name);
    await audit({ userId: user.id, storeId: store.id, action: "order.mark_paid", target: orderId });
  } catch {
    /* state already changed; page reload shows current status */
  }
  revalidatePath(`/admin/${slug}/orders/${orderId}`);
}

export async function refundAction(slug: string, orderId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store, user } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  const amount = parseMoney(String(fd.get("amount") ?? "0") || "0");
  if (amount === null) return fail(t("validation.fixErrors"), { amount: t("products.error.price") });
  try {
    await refundOrder(store, orderId, {
      lines: lineQuantities(fd),
      amountCents: amount,
      restock: bool(fd.get("restock")),
      reason: String(fd.get("reason") ?? "").trim().slice(0, 300),
      notify: bool(fd.get("notify")),
      author: user.name,
    });
  } catch (e) {
    return fail(errorMessage(t, e));
  }
  await audit({ userId: user.id, storeId: store.id, action: "order.refund", target: orderId, meta: { amountCents: amount } });
  revalidatePath(`/admin/${slug}/orders`);
  redirect(`/admin/${slug}/orders/${orderId}`);
}

export async function cancelAction(slug: string, orderId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store, user } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  try {
    await cancelOrder(store, orderId, {
      reason: String(fd.get("reason") ?? "other").slice(0, 100),
      restock: bool(fd.get("restock")),
      refund: bool(fd.get("refund")),
      notify: bool(fd.get("notify")),
      author: user.name,
    });
  } catch (e) {
    return fail(errorMessage(t, e));
  }
  await audit({ userId: user.id, storeId: store.id, action: "order.cancel", target: orderId });
  revalidatePath(`/admin/${slug}/orders`);
  redirect(`/admin/${slug}/orders/${orderId}`);
}

export async function archiveAction(slug: string, orderId: string, archive: boolean) {
  const { store, user } = await requireStoreAccess(slug);
  const order = await db.order.findFirst({ where: { id: orderId, storeId: store.id } });
  if (order && order.status !== "CANCELLED") {
    await db.order.update({ where: { id: order.id }, data: { status: archive ? "ARCHIVED" : "OPEN" } });
    const et = (await import("@/lib/i18n")).getTranslator(store.locale);
    await addOrderEvent(order.id, archive ? "archived" : "unarchived", et(archive ? "event.archived" : "event.unarchived"), user.name);
  }
  revalidatePath(`/admin/${slug}/orders/${orderId}`);
}

export async function commentAction(slug: string, orderId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store, user } = await requireStoreAccess(slug);
  const { t } = await getPlatformT();
  const message = String(fd.get("message") ?? "").trim();
  if (!message) return fail(t("validation.required"));
  const order = await db.order.findFirst({ where: { id: orderId, storeId: store.id } });
  if (!order) return fail(t("common.notFound"));
  await addOrderEvent(order.id, "comment", message, user.name);
  revalidatePath(`/admin/${slug}/orders/${orderId}`);
  return ok();
}

export async function saveOrderNoteAction(slug: string, orderId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store } = await requireStoreAccess(slug);
  const { t } = await getPlatformT();
  await db.order.updateMany({ where: { id: orderId, storeId: store.id }, data: { note: String(fd.get("note") ?? "").slice(0, 2000) || null } });
  revalidatePath(`/admin/${slug}/orders/${orderId}`);
  return ok(t("common.saved"));
}
