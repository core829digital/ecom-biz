import "server-only";
import { cache } from "react";
import type { Plan, Store, User } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * Entitlements: the single place that decides what an account may do.
 * Subscriptions belong to the account (the store owner); every store they own
 * inherits the owner's plan limits and features.
 */

export type LimitKind = "stores" | "products" | "staff";
export type FeatureKind = "customDomain" | "api";

export class PlanLimitError extends Error {
  constructor(public kind: LimitKind | FeatureKind, public limit?: number) {
    super(`Plan limit reached: ${kind}`);
  }
}

type AccountLike = Pick<User, "subscriptionStatus" | "trialEndsAt"> & { plan: Plan | null };

/** An account may operate while subscribed, or while its trial has not ended. */
export function accountActive(user: Pick<User, "subscriptionStatus" | "trialEndsAt">, now = new Date()): boolean {
  if (user.subscriptionStatus === "ACTIVE") return true;
  if (user.subscriptionStatus === "TRIALING") return !user.trialEndsAt || user.trialEndsAt > now;
  return false;
}

export function limitsOf(plan: Plan | null) {
  return {
    stores: plan?.maxStores ?? 1,
    products: plan?.maxProducts ?? null,
    staff: plan?.maxStaff ?? null,
    customDomain: plan?.allowCustomDomain ?? false,
    api: plan?.allowApi ?? false,
  };
}

/** The owner account of a store, with its plan. Memoized per request. */
export const storeOwner = cache(async (storeId: string) => {
  const m = await db.membership.findFirst({
    where: { storeId, role: "OWNER" },
    orderBy: { createdAt: "asc" },
    include: { user: { include: { plan: true } } },
  });
  return m?.user ?? null;
});

/** A store sells only when active and (if billing is enforced) its owner's account is in good standing. */
export async function storeOperational(store: Pick<Store, "id" | "status">): Promise<boolean> {
  if (store.status !== "ACTIVE") return false;
  if (!env.billingEnforced) return true;
  const owner = await storeOwner(store.id);
  return !!owner && accountActive(owner);
}

/** Platform fee in bps for card payments: store override → owner's plan → deployment default. */
export async function feeBpsForStore(store: Pick<Store, "id" | "platformFeeBps">): Promise<number> {
  if (store.platformFeeBps !== null && store.platformFeeBps !== undefined) return store.platformFeeBps;
  const owner = await storeOwner(store.id);
  return owner?.plan ? owner.plan.transactionFeeBps : env.platformFeeBps;
}

export async function ownedStoreCount(userId: string) {
  return db.membership.count({ where: { userId, role: "OWNER", store: { status: { not: "CLOSED" } } } });
}

/** Throws PlanLimitError if the user cannot create another store. Platform admins are exempt. */
export async function assertCanCreateStore(user: Pick<User, "id" | "isPlatformAdmin"> & AccountLike) {
  if (user.isPlatformAdmin) return;
  const limit = limitsOf(user.plan).stores;
  if ((await ownedStoreCount(user.id)) >= limit) throw new PlanLimitError("stores", limit);
}

export async function assertCanAddProducts(storeId: string, adding = 1) {
  const owner = await storeOwner(storeId);
  const limit = limitsOf(owner?.plan ?? null).products;
  if (limit === null || owner?.isPlatformAdmin) return;
  const count = await db.product.count({ where: { storeId } });
  if (count + adding > limit) throw new PlanLimitError("products", limit);
}

export async function assertCanAddStaff(storeId: string) {
  const owner = await storeOwner(storeId);
  const limit = limitsOf(owner?.plan ?? null).staff;
  if (limit === null || owner?.isPlatformAdmin) return;
  const [members, invites] = await Promise.all([
    db.membership.count({ where: { storeId, role: { not: "OWNER" } } }),
    db.staffInvite.count({ where: { storeId, acceptedAt: null, expiresAt: { gt: new Date() } } }),
  ]);
  if (members + invites >= limit) throw new PlanLimitError("staff", limit);
}

export async function assertFeature(storeId: string, feature: FeatureKind) {
  const owner = await storeOwner(storeId);
  if (owner?.isPlatformAdmin) return;
  const l = limitsOf(owner?.plan ?? null);
  if (feature === "customDomain" ? !l.customDomain : !l.api) throw new PlanLimitError(feature);
}

/** Usage numbers for meters in the UI. */
export async function storeUsage(storeId: string) {
  const owner = await storeOwner(storeId);
  const limits = limitsOf(owner?.plan ?? null);
  const [products, staff, stores] = await Promise.all([
    db.product.count({ where: { storeId } }),
    db.membership.count({ where: { storeId, role: { not: "OWNER" } } }),
    owner ? ownedStoreCount(owner.id) : Promise.resolve(1),
  ]);
  return {
    owner,
    plan: owner?.plan ?? null,
    active: owner ? accountActive(owner) : false,
    limits,
    usage: { products, staff, stores },
  };
}
