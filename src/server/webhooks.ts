import "server-only";
import { after } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { hmacSha256 } from "@/lib/crypto";
import { isPublicHttpsUrl } from "@/lib/url-safety";

export const WEBHOOK_TOPICS = [
  "orders/create",
  "orders/paid",
  "orders/cancelled",
  "orders/fulfilled",
  "orders/refunded",
  "products/create",
  "products/update",
  "products/delete",
  "inventory/update",
  "customers/create",
  "customers/update",
] as const;
export type WebhookTopic = (typeof WEBHOOK_TOPICS)[number];

const MAX_ATTEMPTS = 8;
/** Exponential backoff: 1m, 2m, 4m … capped at ~2h. */
function backoffMs(attempt: number) {
  return Math.min(60_000 * 2 ** (attempt - 1), 2 * 3600_000);
}

/**
 * Queue a webhook for every active subscription of `topic` and attempt delivery
 * after the response is sent. Failures are retried by /api/cron/webhooks.
 */
export async function emitWebhook(storeId: string, topic: WebhookTopic, payload: Prisma.InputJsonValue) {
  const subs = await db.webhookSubscription.findMany({ where: { storeId, topic, active: true } });
  if (!subs.length) return;
  const deliveries = await Promise.all(
    subs.map((s) => db.webhookDelivery.create({ data: { subscriptionId: s.id, topic, payload, nextAttemptAt: new Date() } })),
  );
  const run = () => Promise.all(deliveries.map((d) => deliverWebhook(d.id)));
  try {
    after(run);
  } catch {
    // Outside a request scope (scripts/tests): the cron job will deliver it.
  }
}

/**
 * Signature over "<timestamp>.<raw body>" (same scheme as Stripe): the timestamp is authenticated,
 * so receivers can reject replays older than a few minutes.
 */
export function signWebhook(secret: string, timestamp: number, body: string) {
  return hmacSha256(secret, `${timestamp}.${body}`, "base64");
}

export async function deliverWebhook(deliveryId: string): Promise<boolean> {
  const d = await db.webhookDelivery.findUnique({ where: { id: deliveryId }, include: { subscription: true } });
  if (!d || d.success || !d.subscription.active) return false;
  const body = JSON.stringify({ id: d.id, topic: d.topic, created_at: d.createdAt.toISOString(), data: d.payload });
  const attempts = d.attempts + 1;
  let statusCode: number | null = null;
  let error: string | null = null;
  const timestamp = Math.floor(Date.now() / 1000);
  try {
    if (!(await isPublicHttpsUrl(d.subscription.url))) throw new Error("Destination is not a public https URL");
    const res = await fetch(d.subscription.url, {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Commerce-Webhooks/1.0",
        "X-Webhook-Id": d.id,
        "X-Webhook-Topic": d.topic,
        "X-Webhook-Timestamp": String(timestamp),
        "X-Webhook-Signature": signWebhook(d.subscription.secret, timestamp, body),
      },
      body,
    });
    statusCode = res.status;
    if (res.status < 200 || res.status >= 300) error = `HTTP ${res.status}`;
  } catch (e) {
    error = e instanceof Error ? e.message.slice(0, 500) : "Unknown error";
  }
  const success = !error;
  await db.webhookDelivery.update({
    where: { id: d.id },
    data: {
      attempts,
      statusCode,
      error,
      success,
      nextAttemptAt: success || attempts >= MAX_ATTEMPTS ? null : new Date(Date.now() + backoffMs(attempts)),
    },
  });
  if (!success && attempts >= MAX_ATTEMPTS) {
    const { notifyStore } = await import("@/server/notifications");
    const store = await db.store.findUnique({ where: { id: d.subscription.storeId }, select: { slug: true } });
    await notifyStore(d.subscription.storeId, { type: "webhook_failed", data: { topic: d.topic, url: d.subscription.url.slice(0, 80) }, href: store ? `/admin/${store.slug}/settings/developers` : undefined }, ["OWNER", "ADMIN"]);
  }
  return success;
}

/** Retry due deliveries. Called by the cron endpoint. */
export async function processPendingWebhooks(limit = 100) {
  const due = await db.webhookDelivery.findMany({
    where: { success: false, nextAttemptAt: { lte: new Date() } },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
    select: { id: true },
  });
  let delivered = 0;
  for (const d of due) if (await deliverWebhook(d.id)) delivered++;
  return { attempted: due.length, delivered };
}
