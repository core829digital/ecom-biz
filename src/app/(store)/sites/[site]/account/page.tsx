import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { loadStorefront } from "@/server/storefront";
import { getCurrentCustomer } from "@/lib/auth/customer";
import { formatAddressLines } from "@/lib/address";
import { countryName } from "@/lib/geo";
import { customerLogoutAction, deleteMyAccountAction, resendCustomerVerificationAction } from "./actions";
import { SimpleActionForm } from "@/components/storefront/simple-action";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Input } from "@/components/ui/fields";

export const metadata = { robots: { index: false } };

export default async function AccountPage({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<{ welcome?: string; verified?: string }> }) {
  const { site } = await params;
  const flags = await searchParams;
  const sf = await loadStorefront(site);
  const { t } = sf;
  const customer = await getCurrentCustomer(sf.store.id);
  if (!customer) redirect(sf.href("/account/login"));
  const [orders, address] = await Promise.all([
    // Guest orders are matched by email, so the history needs a verified address.
    customer.emailVerifiedAt
      ? db.order.findMany({ where: { storeId: sf.store.id, OR: [{ customerId: customer.id }, { email: customer.email }] }, orderBy: { createdAt: "desc" }, take: 50 })
      : Promise.resolve([]),
    db.customerAddress.findFirst({ where: { customerId: customer.id }, orderBy: { isDefault: "desc" } }),
  ]);
  const date = new Intl.DateTimeFormat(sf.locale === "it" ? "it-IT" : "en-GB", { dateStyle: "medium", timeZone: sf.store.timezone });
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t("sf.account.title")}</h1>
          <p className="mt-1 text-muted">{[customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.email}</p>
        </div>
        <form action={customerLogoutAction.bind(null, site)}><button className="text-sm underline">{t("auth.logout")}</button></form>
      </div>
      {flags.welcome && <p role="status" className="mb-6 rounded-card bg-surface-2 px-4 py-3 text-sm">{t("sf.account.welcome")}</p>}
      {flags.verified && customer.emailVerifiedAt && <p role="status" className="mb-6 rounded-card bg-success-bg px-4 py-3 text-sm text-success">{t("sf.account.verify.done")}</p>}
      {!customer.emailVerifiedAt && (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-card border border-border px-4 py-3 text-sm">
          <p>{t("sf.account.verify.notice", { email: customer.email })}</p>
          <SimpleActionForm action={resendCustomerVerificationAction.bind(null, site)} submitLabel={t("sf.account.verify.resend")}
            buttonClassName="inline-flex h-9 shrink-0 items-center gap-2 rounded-btn border border-border px-4 text-sm font-medium hover:bg-surface-2 disabled:opacity-60" />
        </div>
      )}
      <div className="grid gap-10 md:grid-cols-[1fr_280px]">
        <section>
          <h2 className="mb-4 text-lg font-semibold">{t("sf.account.orders")}</h2>
          {orders.length === 0 ? (
            <p className="text-muted">{customer.emailVerifiedAt ? t("sf.account.noOrders") : t("sf.account.verify.ordersLocked")}</p>
          ) : (
            <ul className="divide-y divide-border border-y border-border">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link href={sf.href(`/orders/${o.statusToken}`)} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-4 hover:bg-surface-2">
                    <span className="font-medium">#{o.number}</span>
                    <span className="text-sm text-muted">{date.format(o.createdAt)}</span>
                    <span className="text-sm">{t(`orders.financial.${o.financialStatus}`)} · {o.status === "CANCELLED" ? t("orders.status.CANCELLED") : t(`orders.fulfillment.${o.fulfillmentStatus}`)}</span>
                    <span className="ml-auto tabular-nums">{sf.money(o.totalCents)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside>
          <h2 className="mb-4 text-lg font-semibold">{t("sf.account.addresses")}</h2>
          {address ? (
            <p className="text-sm text-muted">{formatAddressLines(address as never, (c) => countryName(c, sf.locale)).map((l, i) => <span key={i} className="block">{l}</span>)}</p>
          ) : <p className="text-sm text-muted">{t("sf.account.noAddress")}</p>}
          <Link href={sf.href("/account/addresses")} className="mt-3 inline-block text-sm underline">{t("sf.account.manageAddresses")}</Link>

          <h2 className="mb-2 mt-10 text-lg font-semibold">{t("sf.privacy.title")}</h2>
          <p className="text-sm text-muted">{t("sf.privacy.body")}</p>
          <a href={sf.href("/account/export")} download className="mt-3 inline-block text-sm underline">{t("sf.privacy.download")}</a>
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-danger">{t("sf.privacy.delete")}</summary>
            <p className="mt-2 text-muted">{t("sf.privacy.deleteBody")}</p>
            <ActionForm action={deleteMyAccountAction.bind(null, site)} className="mt-3 space-y-3">
              {customer.passwordHash && <Input name="password" type="password" autoComplete="current-password" label={t("field.password")} required />}
              <SubmitButton variant="danger" className="w-full">{t("sf.privacy.deleteConfirm")}</SubmitButton>
            </ActionForm>
          </details>
        </aside>
      </div>
    </div>
  );
}
