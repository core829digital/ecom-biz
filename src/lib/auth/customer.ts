import "server-only";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";
import { env } from "@/lib/env";

const SESSION_DAYS = 60;

/** Cookie name is scoped per store, so path-based dev URLs on one host never collide. */
export function customerCookieName(storeId: string) {
  return `cs_${storeId}`;
}

export async function createCustomerSession(storeId: string, customerId: string) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.customerSession.create({ data: { tokenHash: sha256(token), customerId, expiresAt } });
  (await cookies()).set(customerCookieName(storeId), token, {
    httpOnly: true,
    secure: env.secureStoreCookies,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroyCustomerSession(storeId: string) {
  const jar = await cookies();
  const token = jar.get(customerCookieName(storeId))?.value;
  if (token) await db.customerSession.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(customerCookieName(storeId));
}

export async function getCurrentCustomer(storeId: string) {
  const token = (await cookies()).get(customerCookieName(storeId))?.value;
  if (!token) return null;
  const session = await db.customerSession.findUnique({
    where: { tokenHash: sha256(token) },
    include: { customer: true },
  });
  if (!session || session.expiresAt < new Date() || session.customer.storeId !== storeId) return null;
  return session.customer;
}
