import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError, apiRoute, list, pagination, productApiInclude, productPayload, sinceFilter } from "@/server/api";
import { apiProductCreate, validationError, variantRows } from "@/server/api-products";
import { uniqueHandle } from "@/server/catalog";
import { handleize } from "@/lib/slug";
import { emitWebhook } from "@/server/webhooks";
import { assertCanAddProducts, PlanLimitError } from "@/server/plans";

export const GET = apiRoute("read_products", async ({ store }, req) => {
  const url = new URL(req.url);
  const { limit, page, skip } = pagination(url);
  const status = url.searchParams.get("status")?.toUpperCase();
  const updatedSince = sinceFilter(url, "updated_since");
  const where: Prisma.ProductWhereInput = {
    storeId: store.id,
    ...(status && ["ACTIVE", "DRAFT", "ARCHIVED"].includes(status) ? { status: status as "ACTIVE" } : {}),
    ...(updatedSince ? { updatedAt: { gte: updatedSince } } : {}),
    ...(url.searchParams.get("handle") ? { handle: url.searchParams.get("handle")! } : {}),
  };
  const [total, products] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({ where, include: productApiInclude, orderBy: { createdAt: "asc" }, skip, take: limit }),
  ]);
  return list(products.map(productPayload), total, page, limit);
});

export const POST = apiRoute("write_products", async ({ store }, req) => {
  const parsed = apiProductCreate.safeParse(await req.json());
  if (!parsed.success) throw validationError(parsed.error);
  const p = parsed.data;
  const variants = variantRows(p);
  try {
    await assertCanAddProducts(store.id);
  } catch (e) {
    if (e instanceof PlanLimitError) throw new ApiError(403, "plan_limit", `Product limit of the current plan reached (${e.limit}).`);
    throw e;
  }
  const status = p.status.toUpperCase() as "ACTIVE" | "DRAFT" | "ARCHIVED";
  const product = await db.product.create({
    data: {
      storeId: store.id,
      title: p.title,
      handle: await uniqueHandle(store.id, p.handle ? handleize(p.handle) : p.title, "product"),
      description: p.description,
      status,
      publishedAt: status === "ACTIVE" ? new Date() : null,
      vendor: p.vendor ?? null,
      productType: p.product_type ?? null,
      tags: p.tags,
      seoTitle: p.seo_title ?? null,
      seoDescription: p.seo_description ?? null,
      options: { create: p.options.map((o, i) => ({ name: o.name, values: o.values, position: i + 1 })) },
      variants: { create: variants },
      images: { create: p.images.map((img, position) => ({ url: img.url, alt: img.alt ?? null, position })) },
    },
    include: productApiInclude,
  });
  await emitWebhook(store.id, "products/create", { id: product.id, title: product.title, handle: product.handle, status: product.status });
  return Response.json({ data: productPayload(product) }, { status: 201 });
});
