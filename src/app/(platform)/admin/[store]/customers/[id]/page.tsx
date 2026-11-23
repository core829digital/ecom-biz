import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStoreAccess, hasRole } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/money";
import { countryName } from "@/lib/geo";
import { formatAddressLines } from "@/lib/address";
import { Card, PageHeader, Stat } from "@/components/ui/primitives";
import { BackLink } from "@/components/admin/back-link";
import { ConfirmSubmit } from "@/components/ui/form";
import { FinancialBadge, FulfillmentBadge } from "@/components/admin/status-badges";
import { CustomerForm } from "../form";
import { deleteCustomerAction, saveCustomerAction } from "../actions";

export default async function CustomerPage({ params }: { params: Promise<{ store: string; id: string }> }) {
  const { store: slug, id } = await params;
  const { store, role } = await requireStoreAccess(slug);
  const { t, locale } = await getPlatformT();
  const customer = await db.customer.findFirst({
    where: { id, storeId: store.id },
    include: { addresses: true, orders: { orderBy: { createdAt: "desc" }, take: 20 } },
  });
  if (!customer) notFound();
  const agg = await db.order.aggregate({ where: { customerId: customer.id, status: { not: "CANCELLED" } }, _count: true, _sum: { totalCents: true, refundedCents: true } });
  const spent = (agg._sum.totalCents ?? 0) - (agg._sum.refundedCents ?? 0);
  const money = (c: number) => formatMoney(c, store.currency, locale);
  const date = new Intl.DateTimeFormat(locale === "it" ? "it-IT" : "en-GB", { dateStyle: "medium", timeZone: store.timezone });
  return (
    <>
      <PageHeader
        back={<BackLink href={`/admin/${slug}/customers`} label={t("nav.customers")} />}
        title={[customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.email}
        subtitle={`${t("customers.since", { date: date.format(customer.createdAt) })}${customer.passwordHash ? ` · ${t("customers.hasAccount")}` : ""}`}
        actions={hasRole(role, "ADMIN") ? <form action={deleteCustomerAction.bind(null, slug, customer.id)}><ConfirmSubmit variant="danger" confirmMessage={t("common.confirmDelete")}>{t("common.delete")}</ConfirmSubmit></form> : null}
      />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Stat label={t("customers.spent")} value={money(spent)} />
        <Stat label={t("nav.orders")} value={agg._count} />
        <Stat label={t("dashboard.aov")} value={agg._count ? money(Math.round(spent / agg._count)) : "—"} />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Card title={t("customers.recentOrders")}>
            {customer.orders.length === 0 ? <p className="text-sm text-muted">{t("customers.noOrders")}</p> : (
              <ul className="divide-y divide-border">
                {customer.orders.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                    <Link href={`/admin/${slug}/orders/${o.id}`} className="font-semibold hover:underline">#{o.number}</Link>
                    <span className="text-muted">{date.format(o.createdAt)}</span>
                    <FinancialBadge status={o.financialStatus} t={t} />
                    <FulfillmentBadge status={o.fulfillmentStatus} t={t} />
                    <span className="ml-auto tabular-nums">{money(o.totalCents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <CustomerForm action={saveCustomerAction.bind(null, slug, customer.id)} customer={customer} t={t} />
        </div>
        <Card title={t("customers.addresses")}>
          {customer.addresses.length === 0 ? <p className="text-sm text-muted">—</p> : customer.addresses.map((a) => (
            <p key={a.id} className="mb-3 text-sm">
              {formatAddressLines(a as never, (c) => countryName(c, locale)).map((l, i) => <span key={i} className="block">{l}</span>)}
              {a.isDefault && <span className="text-xs text-muted">{t("customers.default")}</span>}
            </p>
          ))}
        </Card>
      </div>
    </>
  );
}
