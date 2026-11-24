/**
 * Makes the e2e suite repeatable: restores demo stock (every run buys items) and clears
 * rate-limit counters (every run signs in and submits forms from the same IP).
 * Never touches anything but the demo store and the rate-limit table.
 */
import { PrismaClient } from "@prisma/client";

export default async function globalSetup() {
  const db = new PrismaClient();
  try {
    await db.productVariant.updateMany({ where: { product: { store: { slug: "demo" } } }, data: { inventoryQty: 25 } });
    await db.rateLimit.deleteMany({});
  } finally {
    await db.$disconnect();
  }
}
