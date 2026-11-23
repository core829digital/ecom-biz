import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";
import { env } from "@/lib/env";
import type { Role } from "@prisma/client";

export const STAFF_COOKIE = "sid";
const SESSION_DAYS = 30;

export async function createStaffSession(userId: string) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  const h = await headers();
  await db.session.create({
    data: { tokenHash: sha256(token), userId, expiresAt, userAgent: h.get("user-agent")?.slice(0, 255) },
  });
  const jar = await cookies();
  jar.set(STAFF_COOKIE, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroyStaffSession() {
  const jar = await cookies();
  const token = jar.get(STAFF_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(STAFF_COOKIE);
}

/** Current platform user, or null. Memoized per request. */
export const getCurrentUser = cache(async () => {
  const jar = await cookies();
  const token = jar.get(STAFF_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requirePlatformAdmin() {
  const user = await requireUser();
  if (!user.isPlatformAdmin) redirect("/admin");
  return user;
}

const ROLE_RANK: Record<Role, number> = { STAFF: 1, ADMIN: 2, OWNER: 3 };

/**
 * Tenant guard for the merchant admin. Resolves the store by slug and verifies
 * the current user is a member with at least `minRole`. Every admin page and
 * server action must go through this before touching store data.
 */
export const requireStoreAccess = cache(async (slug: string, minRole: Role = "STAFF") => {
  const user = await requireUser();
  const store = await db.store.findUnique({ where: { slug } });
  if (!store) redirect("/admin");
  const membership = await db.membership.findUnique({
    where: { userId_storeId: { userId: user.id, storeId: store.id } },
  });
  if (!membership && !user.isPlatformAdmin) redirect("/admin");
  const role: Role = membership?.role ?? "OWNER"; // platform admins act as owners
  if (ROLE_RANK[role] < ROLE_RANK[minRole]) redirect(`/admin/${slug}`);
  return { user, store, role };
});

export function hasRole(role: Role, minRole: Role) {
  return ROLE_RANK[role] >= ROLE_RANK[minRole];
}
