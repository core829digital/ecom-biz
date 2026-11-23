import "server-only";
import type { Prisma } from "@prisma/client";

/** Shared filters for the orders list and the CSV export. */
export function ordersWhere(storeId: string, sp: { view?: string; q?: string }): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = { storeId };
  switch (sp.view) {
    case "unfulfilled":
      Object.assign(where, { status: "OPEN", fulfillmentStatus: { in: ["UNFULFILLED", "PARTIALLY_FULFILLED"] } });
      break;
    case "unpaid":
      Object.assign(where, { status: "OPEN", financialStatus: "PENDING" });
      break;
    case "open":
      Object.assign(where, { status: "OPEN" });
      break;
    case "archived":
      Object.assign(where, { status: "ARCHIVED" });
      break;
    case "cancelled":
      Object.assign(where, { status: "CANCELLED" });
      break;
  }
  const q = sp.q?.trim().replace(/^#/, "");
  if (q) {
    const n = /^\d+$/.test(q) ? parseInt(q, 10) : null;
    where.OR = [
      ...(n !== null && n < 2_000_000_000 ? [{ number: n }] : []),
      { email: { contains: q, mode: "insensitive" } },
      { customer: { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }] } },
      { lines: { some: { sku: { equals: q, mode: "insensitive" } } } },
    ];
  }
  return where;
}
