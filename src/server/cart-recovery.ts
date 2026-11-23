import "server-only";
import { db } from "@/lib/db";
import { storePublicUrl } from "@/lib/tenant";
import { sendCartRecovery } from "@/server/emails";
import { storeOperational } from "@/server/plans";

/**
 * Abandoned checkout recovery: one reminder per cart, sent between 1 and 48 hours
 * after the last activity, only for carts where the shopper typed their email.
 */
export async function sendRecoveryEmails(limit = 200) {
  const now = Date.now();
  const carts = await db.cart.findMany({
    where: {
      email: { not: null },
      completedAt: null,
      recoveryEmailSentAt: null,
      updatedAt: { lte: new Date(now - 3600_000), gte: new Date(now - 48 * 3600_000) },
      lines: { some: {} },
      store: { abandonedCartEmails: true, status: "ACTIVE" },
    },
    include: {
      store: true,
      lines: { include: { variant: { include: { product: { select: { title: true, status: true, images: { take: 1, orderBy: { position: "asc" } } } } } } } },
    },
    take: limit,
  });
  let sent = 0;
  for (const cart of carts) {
    // Claim first so concurrent runs never double-send.
    const claimed = await db.cart.updateMany({ where: { id: cart.id, recoveryEmailSentAt: null }, data: { recoveryEmailSentAt: new Date() } });
    if (!claimed.count || !(await storeOperational(cart.store))) continue;
    const lines = cart.lines
      .filter((l) => l.variant.product.status === "ACTIVE")
      .map((l) => ({
        title: l.variant.product.title,
        variantTitle: l.variant.title === "Default" ? null : l.variant.title,
        quantity: l.quantity,
        imageUrl: l.variant.product.images[0]?.url ?? null,
        priceCents: l.variant.priceCents,
      }));
    if (!lines.length) continue;
    await sendCartRecovery(cart.store, cart.email!, lines, `${await storePublicUrl(cart.store)}/cart/recover/${cart.token}`);
    sent++;
  }
  return { candidates: carts.length, sent };
}
