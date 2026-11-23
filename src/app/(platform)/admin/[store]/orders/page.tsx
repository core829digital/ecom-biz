import Link from "next/link";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/money";
import { Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { FilterTabs, Pagination, SearchBox, parsePage } from "@/components/admin/list";
import { FinancialBadge, FulfillmentBadge, OrderStatusBadge } from "@/components/admin/status-badges";
import { ordersWhere } from "@/server/order-queries";

const PER_PAGE = 50;

export default async function OrdersPage({ params, searchParams }: { params: Promise<{ store: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { store: slug } = await params;
  const sp = await searchParams;
  const { store } = await requireStoreAccess(slug);
  const { t, locale } = await getPlatformT();
  const base = `/admin/${slug}/orders`;
  const page = parsePage(sp.page);
  const where = ordersWhere(store.id, sp);
  const [total, orders, any] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { customer: { select: { firstName: true, lastName: true } }, _count: { select: { lines: true } } },
    }),
    db.order.count({ where: { storeId: store.id } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const date = new Intl.DateTimeFormat(locale === "it" ? "it-IT" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: store.timezone });
  const exportHref = `${base}/export?${new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][])}`;

  return (
    <>
      <PageHeader title={t("nav.orders")} actions={any > 0 ? <a href={exportHref} className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-2">{t("products.export")}</a> : null} />
      {any === 0 ? (
        <Card><EmptyState title={t("orders.empty.title")} description={t("orders.empty.description")} /></Card>
      ) : (
        <section className="rounded-xl border border-border bg-surface shadow-sm">
          <FilterTabs
            basePath={base}
            params={sp}
            name="view"
            options={[
              { value: null, label: t("common.all") },
              { value: "unfulfilled", label: t("orders.view.unfulfilled") },
              { value: "unpaid", label: t("orders.view.unpaid") },
              { value: "open", label: t("orders.view.open") },
              { value: "archived", label: t("orders.status.ARCHIVED") },
              { value: "cancelled", label: t("orders.status.CANCELLED") },
            ]}
          />
          <SearchBox basePath={base} params={sp} placeholder={t("orders.search")} />
          <Table>
            <thead>
              <tr>
                <Th>{t("orders.order")}</Th>
                <Th>{t("common.date")}</Th>
                <Th>{t("orders.customer")}</Th>
                <Th>{t("orders.payment")}</Th>
                <Th>{t("orders.fulfillment")}</Th>
                <Th className="text-right">{t("common.total")}</Th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-surface-2/50">
                  <Td>
                    <Link href={`${base}/${o.id}`} className="font-semibold hover:underline">#{o.number}</Link>{" "}
                    <OrderStatusBadge status={o.status} t={t} />
                  </Td>
                  <Td className="whitespace-nowrap text-muted">{date.format(o.createdAt)}</Td>
                  <Td>{[o.customer?.firstName, o.customer?.lastName].filter(Boolean).join(" ") || o.email}</Td>
                  <Td><FinancialBadge status={o.financialStatus} t={t} /></Td>
                  <Td><FulfillmentBadge status={o.fulfillmentStatus} t={t} /></Td>
                  <Td className="text-right tabular-nums">{formatMoney(o.totalCents, o.currency, locale)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {orders.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">{t("products.noResults")}</p>}
          <Pagination basePath={base} params={sp} page={page} pages={pages} labels={{ previous: t("common.previous"), next: t("common.next"), summary: t("common.page", { page, pages }) }} />
        </section>
      )}
    </>
  );
}
