import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { getStripe } from "@/lib/stripe";
import { processPendingWebhooks } from "@/server/webhooks";
import { sendRecoveryEmails } from "@/server/cart-recovery";
import { applyRetention } from "@/server/retention";

export const dynamic = "force-dynamic";

/**
 * Scheduled jobs. Call with `Authorization: Bearer $CRON_SECRET`:
 *   /api/cron/webhooks  — retry failed outbound webhooks (every 5 min)
 *   /api/cron/cleanup   — expire abandoned checkouts, purge old sessions/rate limits (hourly)
 *   /api/cron/recovery  — abandoned-cart reminder emails (every 15–30 min)
 */
export async function GET(req: Request, { params }: { params: Promise<{ job: string }> }) {
  const auth = req.headers.get("authorization") ?? "";
  if (!env.cronSecret || !safeEqual(auth, `Bearer ${env.cronSecret}`)) return new Response("Unauthorized", { status: 401 });
  const { job } = await params;

  if (job === "webhooks") return Response.json(await processPendingWebhooks());
  if (job === "recovery") return Response.json(await sendRecoveryEmails());

  if (job === "cleanup") {
    const cutoff = new Date(Date.now() - 24 * 3600_000);
    const stale = await db.checkout.findMany({ where: { status: "OPEN", createdAt: { lt: cutoff } }, select: { id: true, paymentRef: true, paymentMethod: true }, take: 500 });
    const stripe = getStripe();
    for (const c of stale) {
      if (stripe && c.paymentMethod === "stripe" && c.paymentRef) {
        const pi = await stripe.paymentIntents.retrieve(c.paymentRef).catch(() => null);
        if (pi?.status === "succeeded") continue; // webhook will complete it
        if (pi && ["requires_payment_method", "requires_confirmation", "requires_action"].includes(pi.status)) {
          await stripe.paymentIntents.cancel(pi.id).catch(() => undefined);
        }
      }
      await db.checkout.update({ where: { id: c.id }, data: { status: "EXPIRED" } });
    }
    const now = new Date();
    const [sessions, customerSessions, limits] = await Promise.all([
      db.session.deleteMany({ where: { expiresAt: { lt: now } } }),
      db.customerSession.deleteMany({ where: { expiresAt: { lt: now } } }),
      db.rateLimit.deleteMany({ where: { expiresAt: { lt: now } } }),
    ]);
    const retention = await applyRetention();
    return Response.json({ expiredCheckouts: stale.length, sessions: sessions.count, customerSessions: customerSessions.count, rateLimits: limits.count, retention });
  }
  return new Response("Unknown job", { status: 404 });
}
