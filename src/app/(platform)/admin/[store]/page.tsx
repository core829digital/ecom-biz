import Link from "next/link";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/money";
import { parseTheme } from "@/lib/theme";
import { availablePaymentMethods } from "@/server/payments";
import { Card, PageHeader, Stat } from "@/components/ui/primitives";
import { FinancialBadge, FulfillmentBadge } from "@/components/admin/status-badges";
import { SalesChart } from "@/components/admin/sales-chart";

const DAYS = 30;

export default async function DashboardPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const { store, user } = await requireStoreAccess(slug);
  const { t, locale } = await getPlatformT();
  const base = `/admin/${slug}`;
  const money = (c: number) => formatMoney(c, store.currency, locale);
  const since = new Date(Date.now() - DAYS * 86400_000);
  const tz = store.timezone;

  const [daily, top, recent, lowStock, productCount, rateCount, unfulfilled, unpaid] = await Promise.all([
    db.$queryRaw<{ d: string; net: bigint; orders: bigint }[]>`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS d,
             SUM("totalCents" - "refundedCents")::bigint AS net, COUNT(*)::bigint AS orders
      FROM "Order" WHERE "storeId" = ${store.id} AND "createdAt" >= ${since} AND "status" <> 'CANCELLED'
      GROUP BY 1 ORDER BY 1`,
    db.$queryRaw<{ title: string; qty: bigint; revenue: bigint }[]>`
      SELECT l."title", SUM(l."quantity" - l."refundedQty")::bigint AS qty, SUM(l."priceCents" * (l."quantity" - l."refundedQty") - l."discountCents")::bigint AS revenue
      FROM "OrderLine" l JOIN "Order" o ON o."id" = l."orderId"
      WHERE o."storeId" = ${store.id} AND o."createdAt" >= ${since} AND o."status" <> 'CANCELLED'
      GROUP BY l."title" ORDER BY revenue DESC LIMIT 5`,
    db.order.findMany({ where: { storeId: store.id }, orderBy: { createdAt: "desc" }, take: 6 }),
    db.productVariant.findMany({
      where: { trackInventory: true, allowBackorder: false, inventoryQty: { lte: 3 }, product: { storeId: store.id, status: "ACTIVE" } },
      include: { product: { select: { id: true, title: true } } },
      orderBy: { inventoryQty: "asc" },
      take: 5,
    }),
    db.product.count({ where: { storeId: store.id } }),
    db.shippingRate.count({ where: { zone: { storeId: store.id } } }),
    db.order.count({ where: { storeId: store.id, status: "OPEN", fulfillmentStatus: { not: "FULFILLED" } } }),
    db.order.count({ where: { storeId: store.id, status: "OPEN", financialStatus: "PENDING" } }),
  ]);

  // Fill every day of the window so gaps read as zero, not missing.
  const fmtKey = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  const fmtLabel = new Intl.DateTimeFormat(locale === "it" ? "it-IT" : "en-GB", { timeZone: tz, day: "numeric", month: "short" });
  const byDay = new Map(daily.map((r) => [r.d, r]));
  const points = Array.from({ length: DAYS }, (_, i) => {
    const date = new Date(Date.now() - (DAYS - 1 - i) * 86400_000);
    const key = fmtKey.format(date);
    const row = byDay.get(key);
    const value = Number(row?.net ?? 0);
    return { date: key, label: fmtLabel.format(date), value, display: money(value), orders: Number(row?.orders ?? 0) };
  });
  const totalSales = points.reduce((s, p) => s + p.value, 0);
  const totalOrders = points.reduce((s, p) => s + p.orders, 0);
  const today = points[points.length - 1];

  const theme = parseTheme(store.theme);
  const checklist = [
    { done: productCount > 0, label: t("dashboard.setup.product"), href: `${base}/products/new` },
    { done: availablePaymentMethods(store).filter((m) => m !== "test").length > 0, label: t("dashboard.setup.payments"), href: `${base}/settings/payments` },
    { done: rateCount > 0, label: t("dashboard.setup.shipping"), href: `${base}/settings/shipping` },
    { done: !!(theme.logoUrl || theme.heroImageUrl || theme.primaryColor !== "#111827"), label: t("dashboard.setup.theme"), href: `${base}/online-store/theme` },
  ];
  const setupDone = checklist.every((c) => c.done);
  const date = new Intl.DateTimeFormat(locale === "it" ? "it-IT" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: tz });

  return (
    <>
      <PageHeader title={t("dashboard.greeting", { name: user.name.split(" ")[0] })} subtitle={t("dashboard.subtitle", { days: DAYS })} />

      {!setupDone && (
        <Card className="mb-5" title={t("dashboard.setup.title")}>
          <ul className="grid gap-2 sm:grid-cols-2">
            {checklist.map((c) => (
              <li key={c.href}>
                <Link href={c.href} className={`flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm hover:bg-surface-2 ${c.done ? "text-muted line-through" : ""}`}>
                  <span className={`flex size-5 items-center justify-center rounded-full border text-xs ${c.done ? "border-success bg-success text-white" : "border-border"}`} aria-hidden>{c.done ? "✓" : ""}</span>
                  {c.label}
                  <span className="sr-only">{c.done ? t("dashboard.setup.done") : ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label={t("dashboard.sales", { days: DAYS })} value={money(totalSales)} />
        <Stat label={t("dashboard.orders", { days: DAYS })} value={totalOrders} />
        <Stat label={t("dashboard.aov")} value={totalOrders ? money(Math.round(totalSales / totalOrders)) : "—"} />
        <Stat label={t("dashboard.today")} value={money(today.value)} hint={t("dashboard.ordersCount", { count: today.orders })} />
      </div>

      {(unfulfilled > 0 || unpaid > 0) && (
        <div className="mb-5 flex flex-wrap gap-3">
          {unfulfilled > 0 && <Link href={`${base}/orders?view=unfulfilled`} className="rounded-lg border border-border bg-surface px-4 py-2 text-sm shadow-sm hover:bg-surface-2"><strong>{unfulfilled}</strong> {t("dashboard.toFulfill")} →</Link>}
          {unpaid > 0 && <Link href={`${base}/orders?view=unpaid`} className="rounded-lg border border-border bg-surface px-4 py-2 text-sm shadow-sm hover:bg-surface-2"><strong>{unpaid}</strong> {t("dashboard.awaitingPayment")} →</Link>}
        </div>
      )}

      <Card className="mb-5" title={t("dashboard.salesOverTime")}>
        <SalesChart points={points} ordersLabel={t("dashboard.ordersUnit")} emptyLabel={t("dashboard.noSales")} tableLabel={t("dashboard.salesOverTime")} />
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title={t("dashboard.recentOrders")} className="lg:col-span-2" actions={<Link href={`${base}/orders`} className="text-sm hover:underline">{t("sf.viewAll")}</Link>}>
          {recent.length === 0 ? <p className="text-sm text-muted">{t("orders.empty.title")}</p> : (
            <ul className="divide-y divide-border">
              {recent.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                  <Link href={`${base}/orders/${o.id}`} className="font-semibold hover:underline">#{o.number}</Link>
                  <span className="text-muted">{date.format(o.createdAt)}</span>
                  <FinancialBadge status={o.financialStatus} t={t} />
                  <FulfillmentBadge status={o.fulfillmentStatus} t={t} />
                  <span className="ml-auto tabular-nums">{money(o.totalCents)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="space-y-5">
          <Card title={t("dashboard.topProducts")}>
            {top.length === 0 ? <p className="text-sm text-muted">{t("dashboard.noSales")}</p> : (
              <ol className="space-y-2 text-sm">
                {top.map((p) => (
                  <li key={p.title} className="flex justify-between gap-3">
                    <span className="truncate">{p.title} <span className="text-muted">× {Number(p.qty)}</span></span>
                    <span className="tabular-nums">{money(Number(p.revenue))}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
          <Card title={t("dashboard.lowStock")}>
            {lowStock.length === 0 ? <p className="text-sm text-muted">{t("dashboard.stockOk")}</p> : (
              <ul className="space-y-2 text-sm">
                {lowStock.map((v) => (
                  <li key={v.id} className="flex justify-between gap-3">
                    <Link href={`${base}/products/${v.product.id}`} className="truncate hover:underline">{v.product.title}{v.title !== "Default" && <span className="text-muted"> · {v.title}</span>}</Link>
                    <span className={`tabular-nums ${v.inventoryQty <= 0 ? "text-danger" : "text-warning"}`}>{v.inventoryQty}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
