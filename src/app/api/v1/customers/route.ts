import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, apiRoute, customerPayload, list, pagination, sinceFilter } from "@/server/api";
import { validationError } from "@/server/api-products";
import { emitWebhook } from "@/server/webhooks";

export const GET = apiRoute("read_customers", async ({ store }, req) => {
  const url = new URL(req.url);
  const { limit, page, skip } = pagination(url);
  const email = url.searchParams.get("email")?.toLowerCase();
  const updatedSince = sinceFilter(url, "updated_since");
  const where: Prisma.CustomerWhereInput = { storeId: store.id, ...(email ? { email } : {}), ...(updatedSince ? { updatedAt: { gte: updatedSince } } : {}) };
  const [total, customers] = await Promise.all([
    db.customer.count({ where }),
    db.customer.findMany({ where, orderBy: { createdAt: "asc" }, skip, take: limit }),
  ]);
  return list(customers.map(customerPayload), total, page, limit);
});

const create = z.object({
  email: z.string().trim().toLowerCase().email(),
  first_name: z.string().max(80).optional(),
  last_name: z.string().max(80).optional(),
  phone: z.string().max(40).optional(),
  accepts_marketing: z.boolean().default(false),
  tags: z.array(z.string().max(60)).max(50).default([]),
  note: z.string().max(2000).optional(),
});

export const POST = apiRoute("write_customers", async ({ store }, req) => {
  const parsed = create.safeParse(await req.json());
  if (!parsed.success) throw validationError(parsed.error);
  const c = parsed.data;
  if (await db.customer.findUnique({ where: { storeId_email: { storeId: store.id, email: c.email } } })) {
    throw new ApiError(409, "already_exists", "A customer with this email already exists.");
  }
  const customer = await db.customer.create({
    data: { storeId: store.id, email: c.email, firstName: c.first_name ?? null, lastName: c.last_name ?? null, phone: c.phone ?? null, acceptsMarketing: c.accepts_marketing, tags: c.tags, note: c.note ?? null },
  });
  await emitWebhook(store.id, "customers/create", { id: customer.id, email: customer.email });
  return Response.json({ data: customerPayload(customer) }, { status: 201 });
});
