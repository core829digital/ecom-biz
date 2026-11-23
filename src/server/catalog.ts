import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { handleize } from "@/lib/slug";
import { parseRules, smartCollectionWhere, type CollectionSort } from "@/lib/collections";

type HandleModel = "product" | "collection" | "page";

/** Returns `base` or `base-2`, `base-3`… unique within the store for the given model. */
export async function uniqueHandle(storeId: string, input: string, model: HandleModel, excludeId?: string) {
  const base = handleize(input) || model;
  for (let i = 1; i < 500; i++) {
    const handle = i === 1 ? base : `${base}-${i}`;
    const where = { storeId, handle, ...(excludeId ? { NOT: { id: excludeId } } : {}) };
    const exists =
      model === "product"
        ? await db.product.findFirst({ where, select: { id: true } })
        : model === "collection"
          ? await db.collection.findFirst({ where, select: { id: true } })
          : await db.page.findFirst({ where, select: { id: true } });
    if (!exists) return handle;
  }
  return `${base}-${Date.now()}`;
}

export const productCardInclude = {
  images: { orderBy: { position: "asc" }, take: 2 },
  variants: { orderBy: { position: "asc" }, select: { id: true, priceCents: true, compareAtCents: true, inventoryQty: true, trackInventory: true, allowBackorder: true } },
} satisfies Prisma.ProductInclude;

export type ProductCardData = Prisma.ProductGetPayload<{ include: typeof productCardInclude }>;

function orderBy(sort: CollectionSort): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "title-asc":
      return [{ title: "asc" }];
    case "newest":
    default:
      return [{ createdAt: "desc" }];
  }
}

/** Sort by min variant price in memory (Prisma cannot order by an aggregate of a relation). */
function sortByPrice(products: ProductCardData[], dir: "asc" | "desc") {
  const min = (p: ProductCardData) => Math.min(...p.variants.map((v) => v.priceCents));
  return [...products].sort((a, b) => (dir === "asc" ? min(a) - min(b) : min(b) - min(a)));
}

/** Products visible in a collection on the storefront (ACTIVE only), paginated. */
export async function collectionProducts(
  collection: { id: string; storeId: string; type: "MANUAL" | "SMART"; rules: unknown; matchAll: boolean; sortOrder: string },
  opts: { page?: number; perPage?: number; sort?: CollectionSort } = {},
) {
  const perPage = opts.perPage ?? 24;
  const page = Math.max(1, opts.page ?? 1);
  const sort = (opts.sort ?? collection.sortOrder) as CollectionSort;
  const base: Prisma.ProductWhereInput = { storeId: collection.storeId, status: "ACTIVE" };
  const where: Prisma.ProductWhereInput =
    collection.type === "SMART"
      ? { AND: [base, smartCollectionWhere(parseRules(collection.rules), collection.matchAll)] }
      : { ...base, collections: { some: { collectionId: collection.id } } };

  const total = await db.product.count({ where });
  if (sort === "price-asc" || sort === "price-desc") {
    const all = await db.product.findMany({ where, include: productCardInclude, take: 2000 });
    const sorted = sortByPrice(all, sort === "price-asc" ? "asc" : "desc");
    return { products: sorted.slice((page - 1) * perPage, page * perPage), total, page, perPage };
  }
  if (sort === "manual" && collection.type === "MANUAL") {
    const links = await db.collectionProduct.findMany({
      where: { collectionId: collection.id, product: { status: "ACTIVE" } },
      orderBy: { position: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: { product: { include: productCardInclude } },
    });
    return { products: links.map((l) => l.product), total, page, perPage };
  }
  const products = await db.product.findMany({
    where,
    include: productCardInclude,
    orderBy: orderBy(sort),
    skip: (page - 1) * perPage,
    take: perPage,
  });
  return { products, total, page, perPage };
}
