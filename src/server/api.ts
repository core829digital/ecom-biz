import "server-only";
import type { Prisma, Store } from "@prisma/client";
import { db } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";
import { rateLimit } from "@/lib/rate-limit";
import { accountActive, limitsOf, storeOwner } from "@/server/plans";

export const API_SCOPES = [
  "read_products", "write_products",
  "read_inventory", "write_inventory",
  "read_orders", "write_orders",
  "read_customers", "write_customers",
] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export const RATE_LIMIT_PER_MINUTE = 120;

/** Generates a token; only its SHA-256 is stored. The plaintext is shown to the merchant exactly once. */
export function generateApiToken() {
  const prefix = randomToken(6).replace(/[-_]/g, "x").slice(0, 8);
  const token = `sk_${prefix}_${randomToken(32)}`;
  return { token, prefix, hash: sha256(token) };
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function apiError(status: number, code: string, message: string, headers?: HeadersInit) {
  return Response.json({ error: { code, message } }, { status, headers });
}

export type ApiContext = { store: Store; scopes: string[]; tokenId: string };

/** Authenticate a request and require a scope. Throws ApiError on failure. */
export async function authenticate(req: Request, scope: ApiScope | null): Promise<ApiContext> {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(sk_[A-Za-z0-9_-]+)$/.exec(header.trim());
  if (!match) throw new ApiError(401, "unauthorized", "Missing or malformed bearer token.");
  const token = await db.apiToken.findUnique({ where: { tokenHash: sha256(match[1]) }, include: { store: true } });
  if (!token) throw new ApiError(401, "unauthorized", "Invalid token.");
  if (token.store.status !== "ACTIVE") throw new ApiError(403, "store_inactive", "The store is not active.");
  const owner = await storeOwner(token.storeId);
  if (owner && !owner.isPlatformAdmin && !limitsOf(owner.plan).api) throw new ApiError(403, "plan_feature", "API access is not included in the current plan.");
  if (owner && process.env.BILLING_ENFORCED === "true" && !accountActive(owner)) throw new ApiError(402, "subscription_inactive", "The store's subscription is not active.");
  if (scope && !token.scopes.includes(scope)) throw new ApiError(403, "insufficient_scope", `This token lacks the "${scope}" scope.`);
  if (!(await rateLimit(`api:${token.id}`, RATE_LIMIT_PER_MINUTE, 60))) throw new ApiError(429, "rate_limited", "Too many requests. Limit is 120 per minute.");
  if (!token.lastUsedAt || Date.now() - token.lastUsedAt.getTime() > 60_000) {
    await db.apiToken.update({ where: { id: token.id }, data: { lastUsedAt: new Date() } });
  }
  return { store: token.store, scopes: token.scopes, tokenId: token.id };
}

/** Wrap a route handler with auth + uniform error handling. */
export function apiRoute<P>(scope: ApiScope | null, handler: (ctx: ApiContext, req: Request, params: P) => Promise<Response>) {
  return async (req: Request, { params }: { params: Promise<P> }) => {
    try {
      const ctx = await authenticate(req, scope);
      return await handler(ctx, req, await params);
    } catch (e) {
      if (e instanceof ApiError) return apiError(e.status, e.code, e.message, e.status === 429 ? { "Retry-After": "60" } : undefined);
      if (e instanceof SyntaxError) return apiError(400, "invalid_json", "Request body must be valid JSON.");
      console.error("[api]", e);
      return apiError(500, "internal_error", "Something went wrong.");
    }
  };
}

export function pagination(url: URL) {
  const limit = Math.min(250, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10) || 50));
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  return { limit, page, skip: (page - 1) * limit };
}

export function list<T>(data: T[], total: number, page: number, limit: number) {
  return Response.json({ data, page, limit, total, has_more: page * limit < total });
}

export function sinceFilter(url: URL, param: string): Date | undefined {
  const v = url.searchParams.get(param);
  if (!v) return undefined;
  const d = new Date(v);
  if (isNaN(d.getTime())) throw new ApiError(400, "invalid_parameter", `${param} must be an ISO 8601 date.`);
  return d;
}

export const productApiInclude = {
  options: { orderBy: { position: "asc" } },
  variants: { orderBy: { position: "asc" } },
  images: { orderBy: { position: "asc" } },
} satisfies Prisma.ProductInclude;

export function productPayload(p: Prisma.ProductGetPayload<{ include: typeof productApiInclude }>) {
  return {
    id: p.id,
    title: p.title,
    handle: p.handle,
    description: p.description,
    status: p.status.toLowerCase(),
    vendor: p.vendor,
    product_type: p.productType,
    tags: p.tags,
    seo_title: p.seoTitle,
    seo_description: p.seoDescription,
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt.toISOString(),
    options: p.options.map((o) => ({ name: o.name, values: o.values })),
    images: p.images.map((i) => ({ url: i.url, alt: i.alt })),
    variants: p.variants.map((v) => ({
      id: v.id,
      title: v.title,
      sku: v.sku,
      barcode: v.barcode,
      price: v.priceCents,
      compare_at_price: v.compareAtCents,
      option1: v.option1,
      option2: v.option2,
      option3: v.option3,
      track_inventory: v.trackInventory,
      inventory_quantity: v.inventoryQty,
      allow_backorder: v.allowBackorder,
      requires_shipping: v.requiresShipping,
      taxable: v.taxable,
      weight_grams: v.weightGrams,
    })),
  };
}

export function customerPayload(c: { id: string; email: string; firstName: string | null; lastName: string | null; phone: string | null; acceptsMarketing: boolean; tags: string[]; note: string | null; createdAt: Date }) {
  return {
    id: c.id,
    email: c.email,
    first_name: c.firstName,
    last_name: c.lastName,
    phone: c.phone,
    accepts_marketing: c.acceptsMarketing,
    tags: c.tags,
    note: c.note,
    created_at: c.createdAt.toISOString(),
  };
}
