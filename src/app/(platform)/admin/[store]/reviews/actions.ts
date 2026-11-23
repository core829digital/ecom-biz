"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { fail, ok, type ActionState } from "@/lib/action";
import { getPlatformT } from "@/lib/i18n/server";
import { audit } from "@/server/audit";

const STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
type Status = (typeof STATUSES)[number];

function refresh(slug: string) {
  revalidatePath(`/admin/${slug}/reviews`);
  revalidatePath(`/admin/${slug}`, "layout");
}

export async function setReviewStatusAction(slug: string, reviewId: string, status: Status) {
  if (!STATUSES.includes(status)) return;
  const { store, user } = await requireStoreAccess(slug);
  const res = await db.productReview.updateMany({ where: { id: reviewId, storeId: store.id }, data: { status } });
  if (!res.count) return;
  await audit({ userId: user.id, storeId: store.id, action: `review.${status.toLowerCase()}`, target: reviewId });
  refresh(slug);
}

/** Approve or reject every pending review at once. */
export async function bulkReviewAction(slug: string, status: "APPROVED" | "REJECTED") {
  if (status !== "APPROVED" && status !== "REJECTED") return;
  const { store, user } = await requireStoreAccess(slug);
  const res = await db.productReview.updateMany({ where: { storeId: store.id, status: "PENDING" }, data: { status } });
  if (res.count) await audit({ userId: user.id, storeId: store.id, action: `review.bulk_${status.toLowerCase()}`, meta: { count: res.count } });
  refresh(slug);
}

export async function deleteReviewAction(slug: string, reviewId: string) {
  const { store, user } = await requireStoreAccess(slug);
  const res = await db.productReview.deleteMany({ where: { id: reviewId, storeId: store.id } });
  if (!res.count) return;
  await audit({ userId: user.id, storeId: store.id, action: "review.delete", target: reviewId });
  refresh(slug);
}

export async function replyReviewAction(slug: string, reviewId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store, user } = await requireStoreAccess(slug);
  const { t } = await getPlatformT();
  const reply = String(fd.get("reply") ?? "").trim();
  if (reply.length > 2000) return fail(t("validation.fixErrors"), { reply: t("reviews.replyTooLong") });
  const res = await db.productReview.updateMany({ where: { id: reviewId, storeId: store.id }, data: { reply: reply || null } });
  if (!res.count) return fail(t("common.notFound"));
  await audit({ userId: user.id, storeId: store.id, action: "review.reply", target: reviewId });
  refresh(slug);
  return ok(reply ? t("reviews.replySaved") : t("reviews.replyRemoved"));
}

export async function saveReviewSettingsAction(slug: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store, user } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  const data = { reviewsEnabled: fd.get("reviewsEnabled") === "on", reviewsAutoPublish: fd.get("reviewsAutoPublish") === "on" };
  await db.store.update({ where: { id: store.id }, data });
  await audit({ userId: user.id, storeId: store.id, action: "settings.reviews", meta: data });
  refresh(slug);
  return ok(t("common.saved"));
}
