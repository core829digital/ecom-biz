import { db } from "@/lib/db";
import { ApiError, apiRoute, customerPayload } from "@/server/api";

export const GET = apiRoute<{ id: string }>("read_customers", async ({ store }, _req, { id }) => {
  const customer = await db.customer.findFirst({ where: { id, storeId: store.id }, include: { addresses: true, _count: { select: { orders: true } } } });
  if (!customer) throw new ApiError(404, "not_found", "Customer not found.");
  return Response.json({
    data: {
      ...customerPayload(customer),
      orders_count: customer._count.orders,
      addresses: customer.addresses.map((a) => ({ first_name: a.firstName, last_name: a.lastName, company: a.company, address1: a.address1, address2: a.address2, city: a.city, province: a.province, zip: a.zip, country_code: a.countryCode, phone: a.phone, default: a.isDefault })),
    },
  });
});
