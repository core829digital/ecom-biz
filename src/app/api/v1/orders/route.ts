import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { apiRoute, list, pagination, sinceFilter } from "@/server/api";
import { orderPayload } from "@/server/orders";

export const GET = apiRoute("read_orders", async ({ store }, req) => {
  const url = new URL(req.url);
  const { limit, page, skip } = pagination(url);
  const createdSince = sinceFilter(url, "created_since");
  const updatedSince = sinceFilter(url, "updated_since");
  const up = (k: string) => url.searchParams.get(k)?.toUpperCase();
  const where: Prisma.OrderWhereInput = {
    storeId: store.id,
    ...(createdSince ? { createdAt: { gte: createdSince } } : {}),
    ...(updatedSince ? { updatedAt: { gte: updatedSince } } : {}),
    ...(up("status") && ["OPEN", "ARCHIVED", "CANCELLED"].includes(up("status")!) ? { status: up("status") as "OPEN" } : {}),
    ...(up("financial_status") && ["PENDING", "PAID", "PARTIALLY_REFUNDED", "REFUNDED", "VOIDED"].includes(up("financial_status")!) ? { financialStatus: up("financial_status") as "PAID" } : {}),
    ...(up("fulfillment_status") && ["UNFULFILLED", "PARTIALLY_FULFILLED", "FULFILLED"].includes(up("fulfillment_status")!) ? { fulfillmentStatus: up("fulfillment_status") as "FULFILLED" } : {}),
  };
  const [total, orders] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({ where, include: { lines: true }, orderBy: { number: "asc" }, skip, take: limit }),
  ]);
  return list(orders.map(orderPayload), total, page, limit);
});
