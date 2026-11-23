import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, apiRoute } from "@/server/api";
import { validationError } from "@/server/api-products";
import { fulfillOrder, OrderActionError } from "@/server/order-admin";

const body = z.object({
  lines: z.array(z.object({ line_id: z.string(), quantity: z.number().int().min(1) })).optional(),
  tracking_company: z.string().max(80).optional(),
  tracking_number: z.string().max(120).optional(),
  tracking_url: z.string().url().max(500).optional(),
  notify_customer: z.boolean().default(true),
});

/** Fulfill an order (all remaining items when `lines` is omitted). Used by WMS / shipping integrations. */
export const POST = apiRoute<{ id: string }>("write_orders", async ({ store }, req, { id }) => {
  const parsed = body.safeParse(await req.json());
  if (!parsed.success) throw validationError(parsed.error);
  const b = parsed.data;
  try {
    const f = await fulfillOrder(store, id, {
      lines: b.lines?.map((l) => ({ lineId: l.line_id, quantity: l.quantity })),
      trackingCompany: b.tracking_company,
      trackingNumber: b.tracking_number,
      trackingUrl: b.tracking_url,
      notify: b.notify_customer,
      author: "API",
    });
    const order = await db.order.findUniqueOrThrow({ where: { id }, select: { fulfillmentStatus: true } });
    return Response.json({ data: { id: f.id, order_fulfillment_status: order.fulfillmentStatus.toLowerCase() } }, { status: 201 });
  } catch (e) {
    if (e instanceof OrderActionError) {
      const map = { not_found: 404, invalid: 422, nothing: 422, amount: 422, provider: 502, state: 409 } as const;
      throw new ApiError(map[e.code], e.code, `Fulfillment failed: ${e.code}`);
    }
    throw e;
  }
});
