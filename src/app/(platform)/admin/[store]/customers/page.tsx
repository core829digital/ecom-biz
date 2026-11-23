import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/money";
import { Badge, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { LinkButton } from "@/components/ui/button";
import { Pagination, SearchBox, parsePage } from "@/components/admin/list";

const PER_PAGE = 50;

export default async function CustomersPage({ params, searchParams }: { params: Promise<{ store: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { store: slug } = await params;
  const sp = await searchParams;
  const { store } = await requireStoreAccess(slug);
  const { t, locale } = await getPlatformT();
  const base = `/admin/${slug}/customers`;
  const page = parsePage(sp.page);
  const q = sp.q?.trim();
  const where: Prisma.CustomerWhereInput = {
    storeId: store.id,
    ...(q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { tags: { has: q } }] } : {}),
  };
  const [total, customers] = await Promise.all([
    db.customer.count({ where }),
    db.customer.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
  ]);
  const stats = await db.order.groupBy({
    by: ["customerId"],
    where: { storeId: store.id, customerId: { in: customers.map((c) => c.id) }, status: { not: "CANCELLED" } },
    _count: true,
    _sum: { totalCents: true, refundedCents: true },
  });
  const byId = new Map(stats.map((s) => [s.customerId, s]));
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  return (
    <>
      <PageHeader title={t("nav.customers")} actions={<LinkButton href={`${base}/new`} size="sm">{t("customers.add")}</LinkButton>} />
      <section className="rounded-xl border border-border bg-surface shadow-sm">
        <SearchBox basePath={base} params={sp} placeholder={t("customers.search")} />
        {customers.length === 0 && !q ? (
          <EmptyState title={t("customers.empty.title")} description={t("customers.empty.description")} />
        ) : (
          <Table>
            <thead><tr><Th>{t("common.name")}</Th><Th>{t("field.email")}</Th><Th>{t("nav.orders")}</Th><Th className="text-right">{t("customers.spent")}</Th></tr></thead>
            <tbody>
              {customers.map((c) => {
                const s = byId.get(c.id);
                return (
                  <tr key={c.id} className="hover:bg-surface-2/50">
                    <Td>
                      <Link href={`${base}/${c.id}`} className="font-medium hover:underline">{[c.firstName, c.lastName].filter(Boolean).join(" ") || "—"}</Link>{" "}
                      {c.acceptsMarketing && <Badge tone="info">{t("customers.subscribed")}</Badge>}
                    </Td>
                    <Td className="text-muted">{c.email}</Td>
                    <Td>{s?._count ?? 0}</Td>
                    <Td className="text-right tabular-nums">{formatMoney((s?._sum.totalCents ?? 0) - (s?._sum.refundedCents ?? 0), store.currency, locale)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        {customers.length === 0 && q && <p className="px-4 py-10 text-center text-sm text-muted">{t("products.noResults")}</p>}
        <Pagination basePath={base} params={sp} page={page} pages={pages} labels={{ previous: t("common.previous"), next: t("common.next"), summary: t("common.page", { page, pages }) }} />
      </section>
    </>
  );
}
