import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { Store } from "@prisma/client";

/** Resolve a storefront site key (slug or custom hostname) to a live store. */
export const resolveStore = cache(async (siteKey: string): Promise<Store | null> => {
  const key = decodeURIComponent(siteKey).toLowerCase();
  let store: Store | null;
  if (key.includes(".")) {
    const domain = await db.domain.findUnique({ where: { hostname: key }, include: { store: true } });
    store = domain?.verifiedAt ? domain.store : null;
  } else {
    store = await db.store.findUnique({ where: { slug: key } });
  }
  if (!store || store.status !== "ACTIVE") return null;
  return store;
});

/**
 * Prefix for storefront links. Empty on a real store host (middleware sets the header);
 * "/sites/<key>" when browsing the path-based development URL.
 */
export async function storeBase(siteKey: string): Promise<string> {
  const h = await headers();
  return h.has("x-store-base") ? "" : `/sites/${siteKey}`;
}

/** Canonical public URL of a store (primary verified custom domain, else subdomain). */
export async function storePublicUrl(store: Pick<Store, "id" | "slug">): Promise<string> {
  const primary = await db.domain.findFirst({
    where: { storeId: store.id, isPrimary: true, verifiedAt: { not: null } },
  });
  if (primary) return `https://${primary.hostname}`;
  if (env.storefrontPathMode) return `${env.appUrl}/sites/${store.slug}`;
  return `${env.storefrontProtocol}://${env.storeAddress(store.slug)}`;
}
