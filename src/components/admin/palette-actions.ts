"use server";

import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";

export type PaletteResult = { kind: "product" | "order" | "customer"; label: string; detail: string; href: string };

/** Live search for the command palette, scoped to one store. */
export async function paletteSearchAction(slug: string, q: string): Promise<PaletteResult[]> {
  const { store } = await requireStoreAccess(slug);
  const query = q.trim().replace(/^#/, "").slice(0, 80);
  if (query.length < 2) return [];
  const base = `/admin/${slug}`;
  const num = /^\d+$/.test(query) && Number(query) < 2e9 ? Number(query) : null;
  const [products, orders, customers] = await Promise.all([
    db.product.findMany({
      where: { storeId: store.id, OR: [{ title: { contains: query, mode: "insensitive" } }, { variants: { some: { sku: { contains: query, mode: "insensitive" } } } }] },
      select: { id: true, title: true, status: true },
      take: 5,
    }),
    db.order.findMany({
      where: { storeId: store.id, OR: [...(num !== null ? [{ number: num }] : []), { email: { contains: query, mode: "insensitive" } }] },
      select: { id: true, number: true, email: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.customer.findMany({
      where: { storeId: store.id, OR: [{ email: { contains: query, mode: "insensitive" } }, { firstName: { contains: query, mode: "insensitive" } }, { lastName: { contains: query, mode: "insensitive" } }] },
      select: { id: true, email: true, firstName: true, lastName: true },
      take: 5,
    }),
  ]);
  return [
    ...orders.map((o) => ({ kind: "order" as const, label: `#${o.number}`, detail: o.email, href: `${base}/orders/${o.id}` })),
    ...products.map((p) => ({ kind: "product" as const, label: p.title, detail: p.status.toLowerCase(), href: `${base}/products/${p.id}` })),
    ...customers.map((c) => ({ kind: "customer" as const, label: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email, detail: c.email, href: `${base}/customers/${c.id}` })),
  ];
}
