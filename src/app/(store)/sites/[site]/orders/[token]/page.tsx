import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { loadStorefront } from "@/server/storefront";
import { formatAddressLines, type Address } from "@/lib/address";
import { countryName } from "@/lib/geo";

export const metadata = { robots: { index: false } };

export default async function OrderStatusPage({ params }: { params: Promise<{ site: string; token: string }> }) {
  const { site, token } = await params;
  const sf = await loadStorefront(site);
  const { t } = sf;
  const order = await db.order.findFirst({
    where: { statusToken: token, storeId: sf.store.id },
    include: { lines: true, fulfillments: { orderBy: { createdAt: "desc" } } },
  });
  if (!order) notFound();
  const address = formatAddressLines(order.shippingAddress as Address, (c) => countryName(c, sf.locale));
  const steps = [
    { label: t("orders.step.confirmed"), done: true },
    { label: t("orders.step.shipped"), done: order.fulfillmentStatus !== "UNFULFILLED" },
    { label: t("orders.step.delivered"), done: order.fulfillmentStatus === "FULFILLED" && order.fulfillments.length > 0 },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-sm text-muted">{t("orders.number", { number: order.number })}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">
        {order.status === "CANCELLED" ? t("orders.cancelledTitle") : t("orders.thankYou", { name: (order.shippingAddress as Address | null)?.firstName ?? "" })}
      </h1>
      <p className="mt-2 text-muted">{order.status === "CANCELLED" ? t("email.cancel.body") : t("orders.confirmationSent", { email: order.email })}</p>

      {order.status !== "CANCELLED" && (
        <ol className="mt-8 grid grid-cols-3 gap-2 text-center text-sm">
          {steps.map((s) => (
            <li key={s.label} className={`rounded-lg border p-3 ${s.done ? "border-text font-medium" : "border-border text-muted"}`}>{s.done ? "✓ " : ""}{s.label}</li>
          ))}
        </ol>
      )}

      {order.financialStatus === "PENDING" && order.paymentInstructions && order.status !== "CANCELLED" && (
        <div className="mt-8 rounded-xl border border-border p-5">
          <h2 className="font-semibold">{t("checkout.paymentInstructions")}</h2>
          <p className="mt-2 whitespace-pre-line text-sm">{order.paymentInstructions}</p>
          <p className="mt-2 text-sm text-muted">{t("orders.reference", { number: order.number })}</p>
        </div>
      )}

      {order.fulfillments.some((f) => f.trackingNumber) && (
        <div className="mt-8 rounded-xl border border-border p-5">
          <h2 className="font-semibold">{t("orders.tracking")}</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {order.fulfillments.filter((f) => f.trackingNumber).map((f) => (
              <li key={f.id}>
                {[f.trackingCompany, f.trackingNumber].filter(Boolean).join(" · ")}
                {f.trackingUrl && /^https?:\/\//.test(f.trackingUrl) && <> — <a href={f.trackingUrl} target="_blank" rel="noopener noreferrer" className="underline">{t("email.shipping.track")}</a></>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 rounded-xl bg-surface-2 p-5">
        <ul className="divide-y divide-border">
          {order.lines.map((l) => (
            <li key={l.id} className="flex items-center gap-3 py-3 text-sm">
              <span className="size-14 shrink-0 overflow-hidden rounded-lg bg-bg">{l.imageUrl && <img src={l.imageUrl} alt="" className="size-full object-cover" />}</span>
              <span className="flex-1"><span className="block font-medium">{l.title}</span>{l.variantTitle && <span className="text-muted">{l.variantTitle}</span>}</span>
              <span className="text-muted">× {l.quantity}</span>
              <span className="w-24 text-right tabular-nums">{sf.money(l.priceCents * l.quantity)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1.5 border-t border-border pt-3 text-sm">
          <div className="flex justify-between"><dt>{t("sf.subtotal")}</dt><dd>{sf.money(order.subtotalCents)}</dd></div>
          {order.discountCents > 0 && <div className="flex justify-between"><dt>{t("checkout.discount")} {order.discountCode && `(${order.discountCode})`}</dt><dd>−{sf.money(order.discountCents)}</dd></div>}
          {order.shippingTitle && <div className="flex justify-between"><dt>{t("checkout.shipping")} · {order.shippingTitle}</dt><dd>{order.shippingCents ? sf.money(order.shippingCents) : t("checkout.free")}</dd></div>}
          <div className="flex justify-between"><dt>{order.taxesIncluded ? t("checkout.taxIncluded") : t("checkout.tax")}</dt><dd>{sf.money(order.taxCents)}</dd></div>
          {order.refundedCents > 0 && <div className="flex justify-between"><dt>{t("orders.refunded")}</dt><dd>−{sf.money(order.refundedCents)}</dd></div>}
          <div className="flex justify-between border-t border-border pt-2 text-base font-semibold"><dt>{t("common.total")}</dt><dd>{sf.money(order.totalCents)}</dd></div>
        </dl>
      </div>

      {address.length > 0 && (
        <div className="mt-8 text-sm">
          <h2 className="mb-1 font-semibold">{t("checkout.shippingAddress")}</h2>
          <p className="text-muted">{address.map((l, i) => <span key={i} className="block">{l}</span>)}</p>
        </div>
      )}
      <div className="mt-10 flex flex-wrap items-center gap-3">
        <Link href={sf.href("/")} className="inline-flex h-12 items-center rounded-btn bg-brand px-7 font-medium text-brand-contrast">{t("sf.continueShopping")}</Link>
        {order.status !== "CANCELLED" && <Link href={sf.href(`/orders/${token}/receipt`)} className="inline-flex h-12 items-center rounded-btn border border-border px-6 font-medium hover:bg-surface-2">{t("receipt.view")}</Link>}
      </div>
    </div>
  );
}
