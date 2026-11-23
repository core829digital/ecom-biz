import { db } from "@/lib/db";
import { getPlatformT } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/money";
import { PageHeader, Stat } from "@/components/ui/primitives";

export default async function PlatformOverview() {
  const { t, locale } = await getPlatformT();
  const since = new Date(Date.now() - 30 * 86400_000);
  const [stores, active, users, orders, byCurrency] = await Promise.all([
    db.store.count(),
    db.store.count({ where: { status: "ACTIVE" } }),
    db.user.count(),
    db.order.count({ where: { createdAt: { gte: since }, status: { not: "CANCELLED" } } }),
    db.order.groupBy({
      by: ["currency"],
      where: { createdAt: { gte: since }, status: { not: "CANCELLED" } },
      _sum: { totalCents: true, refundedCents: true, platformFeeCents: true },
    }),
  ]);
  return (
    <>
      <PageHeader title={t("platform.overview")} subtitle={t("dashboard.subtitle", { days: 30 })} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label={t("platform.stores")} value={stores} hint={t("platform.activeCount", { count: active })} />
        <Stat label={t("platform.users")} value={users} />
        <Stat label={t("dashboard.orders", { days: 30 })} value={orders} />
        <Stat label={t("platform.currencies")} value={byCurrency.length} />
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {byCurrency.map((c) => (
          <div key={c.currency} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <p className="text-xs font-medium text-muted">{c.currency}</p>
            <p className="mt-1 text-sm">{t("platform.gmv")}: <strong className="tabular-nums">{formatMoney((c._sum.totalCents ?? 0) - (c._sum.refundedCents ?? 0), c.currency, locale)}</strong></p>
            <p className="text-sm">{t("platform.fees")}: <strong className="tabular-nums">{formatMoney(c._sum.platformFeeCents ?? 0, c.currency, locale)}</strong></p>
          </div>
        ))}
      </div>
    </>
  );
}
