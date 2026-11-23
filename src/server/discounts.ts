import "server-only";
import { db } from "@/lib/db";
import type { Discount } from "@prisma/client";

export type DiscountCheck = { discount: Discount; error?: undefined } | { discount?: undefined; error: "not_found" | "expired" | "not_started" | "used_up" | "already_used" };

export function normalizeCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

/** Validate a code for a store (everything except the minimum subtotal, which the pricing engine checks). */
export async function checkDiscount(storeId: string, rawCode: string, email?: string | null): Promise<DiscountCheck> {
  const code = normalizeCode(rawCode);
  if (!code) return { error: "not_found" };
  const discount = await db.discount.findUnique({ where: { storeId_code: { storeId, code } } });
  if (!discount || !discount.active) return { error: "not_found" };
  const now = new Date();
  if (discount.startsAt > now) return { error: "not_started" };
  if (discount.endsAt && discount.endsAt <= now) return { error: "expired" };
  if (discount.usageLimit !== null && discount.usageCount >= discount.usageLimit) return { error: "used_up" };
  if (discount.oncePerCustomer && email) {
    const used = await db.order.count({
      where: { storeId, discountCode: code, email: email.toLowerCase(), status: { not: "CANCELLED" } },
    });
    if (used > 0) return { error: "already_used" };
  }
  return { discount };
}
