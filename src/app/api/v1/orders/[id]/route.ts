import { db } from "@/lib/db";
import { ApiError, apiRoute } from "@/server/api";
import { orderPayload } from "@/server/orders";

export const GET = apiRoute<{ id: string }>("read_orders", async ({ store }, _req, { id }) => {
  const order = await db.order.findFirst({ where: { storeId: store.id, OR: [{ id }, ...(/^\d+$/.test(id) && Number(id) < 2e9 ? [{ number: Number(id) }] : [])] }, include: { lines: true, fulfillments: true } });
  if (!order) throw new ApiError(404, "not_found", "Order not found.");
  return Response.json({
    data: {
      ...orderPayload(order),
      fulfillments: order.fulfillments.map((f) => ({ id: f.id, tracking_company: f.trackingCompany, tracking_number: f.trackingNumber, tracking_url: f.trackingUrl, created_at: f.createdAt.toISOString() })),
    },
  });
});
