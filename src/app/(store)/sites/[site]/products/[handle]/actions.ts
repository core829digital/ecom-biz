"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { loadStorefront } from "@/server/storefront";
import { subscribeStockAlert } from "@/server/stock-alerts";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/http";
import { getCurrentCustomer } from "@/lib/auth/customer";

const emailSchema = z.string().trim().toLowerCase().email().max(200);

export async function subscribeStockAlertAction(site: string, variantId: string, email: string): Promise<{ ok: boolean; message: string }> {
  const sf = await loadStorefront(site);
  if (!(await rateLimit(`stock-alert:${sf.store.id}:${await clientIp()}`, 20, 3600))) return { ok: false, message: sf.t("auth.error.rateLimited") };
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { ok: false, message: sf.t("validation.email") };
  const variant = await db.productVariant.findFirst({ where: { id: variantId, product: { storeId: sf.store.id, status: "ACTIVE" } }, select: { id: true } });
  if (!variant) return { ok: false, message: sf.t("sf.unavailableVariant") };
  await subscribeStockAlert(sf.store.id, variant.id, parsed.data);
  return { ok: true, message: sf.t("sf.notify.done") };
}

export type ReviewState = { ok?: boolean; error?: string; message?: string; at?: number } | null;

export async function submitReviewAction(site: string, productId: string, _: ReviewState, fd: FormData): Promise<ReviewState> {
  const sf = await loadStorefront(site);
  const { t, store } = sf;
  if (!store.reviewsEnabled) return { error: t("sf.reviews.disabled"), at: Date.now() };
  if (!(await rateLimit(`review:${store.id}:${await clientIp()}`, 5, 3600))) return { error: t("auth.error.rateLimited"), at: Date.now() };
  const schema = z.object({
    name: z.string().trim().min(1).max(60),
    email: emailSchema,
    rating: z.coerce.number().int().min(1).max(5),
    title: z.string().trim().max(120).optional().default(""),
    body: z.string().trim().min(10).max(4000),
  });
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: t("sf.reviews.invalid"), at: Date.now() };
  const product = await db.product.findFirst({ where: { id: productId, storeId: store.id, status: "ACTIVE" }, select: { id: true } });
  if (!product) return { error: t("common.notFound"), at: Date.now() };
  const d = parsed.data;
  // One review per email per product.
  if (await db.productReview.findFirst({ where: { productId, email: d.email } })) return { error: t("sf.reviews.already"), at: Date.now() };
  // "Verified purchase" only for a signed-in customer (their email is proven by account
  // activation); a typed email alone could be anyone's.
  const customer = await getCurrentCustomer(store.id);
  const verified = customer?.email === d.email && (await db.orderLine.count({
    where: { productId, order: { storeId: store.id, customerId: customer.id, financialStatus: { in: ["PAID", "PARTIALLY_REFUNDED"] } } },
  })) > 0;
  await db.productReview.create({
    data: {
      storeId: store.id, productId, name: d.name, email: d.email, rating: d.rating, title: d.title || null, body: d.body,
      verifiedPurchase: verified, status: store.reviewsAutoPublish ? "APPROVED" : "PENDING",
    },
  });
  revalidatePath("/", "layout");
  return { ok: true, message: store.reviewsAutoPublish ? t("sf.reviews.published") : t("sf.reviews.thanks"), at: Date.now() };
}
