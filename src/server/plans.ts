import "server-only";
import { cache } from "react";
import type { Plan, Store, User } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { accountActive as rulesAccountActive, storesWithinLimit } from "@/lib/billing-rules";

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

/**
 * An account may operate while subscribed, during its trial, during the grace period after a
 * failed renewal, and never while on hold (payment dispute). Rules live in billing-rules.ts.
 */
export function accountActive(user: Pick<User, "subscriptionStatus" | "trialEndsAt"> & Partial<Pick<User, "pastDueSince" | "billingHold">>, now = new Date()): boolean {
  return rulesAccountActive(user, now);
}

export function limitsOf(plan: Plan | null) {
  return {
    stores: plan?.maxStores ?? 1,
    products: plan?.maxProducts ?? null,
    staff: plan?.maxStaff ?? null,
    customDomain: plan?.allowCustomDomain ?? false,
    api: plan?.allowApi ?? false,
    /** Storefront animations: 0 none, 1 essential presets, 2 premium presets + per-section entrances. */
    motion: (plan?.motionLevel ?? 1) as 0 | 1 | 2,
    customCss: plan?.allowCustomCss ?? false,
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

/** Stores owned by an account (oldest first). Memoized per request. */
const ownedStores = cache((userId: string) =>
  db.store.findMany({ where: { status: { not: "CLOSED" }, memberships: { some: { userId, role: "OWNER" } } }, select: { id: true, createdAt: true }, orderBy: { createdAt: "asc" } }),
);

export type StoreAvailability = "ok" | "store_inactive" | "account_inactive" | "over_store_limit";

/**
 * Why a store can or cannot sell. With billing enforced, the owner's account must be in good
 * standing, and only as many stores as the plan allows stay open (the oldest ones): downgrading
 * from a bigger plan pauses the extra stores instead of keeping them for free.
 */
export async function storeAvailability(store: Pick<Store, "id" | "status">): Promise<StoreAvailability> {
  if (store.status !== "ACTIVE") return "store_inactive";
  if (!env.billingEnforced) return "ok";
  const owner = await storeOwner(store.id);
  if (!owner || !accountActive(owner)) return "account_inactive";
  if (owner.isPlatformAdmin) return "ok";
  const allowed = storesWithinLimit(await ownedStores(owner.id), limitsOf(owner.plan).stores);
  return allowed.has(store.id) ? "ok" : "over_store_limit";
}

/** A store sells only when it is available (see storeAvailability). */
export async function storeOperational(store: Pick<Store, "id" | "status">): Promise<boolean> {
  return (await storeAvailability(store)) === "ok";
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
