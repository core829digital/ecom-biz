import type { Order, OrderLine, Store } from "@prisma/client";
import type { Translator } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { formatAddressLines, type Address } from "@/lib/address";
import { countryName } from "@/lib/geo";
import { PrintButton } from "@/components/print-button";
import { vatBreakdown } from "@/lib/vat-breakdown";

/** Printable order receipt with VAT summary. Not a fiscal invoice (see disclaimer). */
export function Receipt({ store, order, lines, t, locale, backHref }: { store: Store; order: Order; lines: OrderLine[]; t: Translator; locale: string; backHref: string }) {
  const money = (c: number) => formatMoney(c, order.currency, locale);
  const pct = (bps: number) => new Intl.NumberFormat(locale === "it" ? "it-IT" : "en-GB", { style: "percent", maximumFractionDigits: 2 }).format(bps / 10_000);
  const date = new Intl.DateTimeFormat(locale === "it" ? "it-IT" : "en-GB", { dateStyle: "long", timeZone: store.timezone }).format(order.createdAt);
  const billTo = formatAddressLines((order.billingAddress ?? order.shippingAddress) as Address, (c) => countryName(c, locale));
  const seller = [store.legalName || store.name, store.address1, store.address2, [store.zip, store.city].filter(Boolean).join(" "), countryName(store.countryCode, locale), store.vatNumber && t("receipt.vatNumber", { vat: store.vatNumber })]
    .filter((l): l is string => !!l);
  const vat = vatBreakdown(order, lines);
  const paid = order.financialStatus === "PAID" || order.financialStatus === "PARTIALLY_REFUNDED" || order.financialStatus === "REFUNDED";

  return (
    <div className="print-area fixed inset-0 z-50 overflow-auto bg-white px-4 py-8 text-black sm:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between print:hidden">
          <a href={backHref} className="text-sm underline">← {t("common.back")}</a>
          <PrintButton label={t("receipt.print")} />
        </div>

        <header className="flex flex-wrap justify-between gap-4 border-b border-black/20 pb-4">
          <div>
            <h1 className="text-2xl font-semibold">{store.name}</h1>
            <p className="text-sm">{t("receipt.title")}</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">{t("orders.number", { number: order.number })}</p>
            <p>{date}</p>
            <p className="mt-1 inline-block rounded border border-black/40 px-1.5 text-xs font-medium uppercase tracking-wide">{paid ? t("receipt.paid") : t("receipt.unpaid")}</p>
          </div>
        </header>

        <section className="mt-6 grid gap-6 text-sm sm:grid-cols-2 sm:gap-8">
          <div><p className="mb-1 font-semibold">{t("receipt.billTo")}</p>{billTo.map((l, i) => <p key={i}>{l}</p>)}<p>{order.email}</p></div>
          <div><p className="mb-1 font-semibold">{t("receipt.seller")}</p>{seller.map((l, i) => <p key={i}>{l}</p>)}</div>
        </section>

        <div className="mt-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/20 text-left">
                <th className="py-2 font-semibold">{t("receipt.item")}</th>
                <th className="hidden py-2 text-right font-semibold sm:table-cell">{t("receipt.unitPrice")}</th>
                <th className="hidden py-2 text-right font-semibold sm:table-cell">{t("receipt.qty")}</th>
                <th className="py-2 text-right font-semibold">{t("receipt.amount")}</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} className="border-b border-black/10 align-top">
                  <td className="py-2">
                    {l.title}
                    {l.variantTitle && <span className="block text-xs">{l.variantTitle}</span>}
                    <span className="block text-xs sm:hidden">{l.quantity} × {money(l.priceCents)}</span>
                    {l.sku && <span className="block text-xs text-black/60">SKU {l.sku}</span>}
                    {l.discountCents > 0 && <span className="block text-xs">{t("checkout.discount")} −{money(l.discountCents)}</span>}
                  </td>
                  <td className="hidden py-2 text-right tabular-nums sm:table-cell">{money(l.priceCents)}</td>
                  <td className="hidden py-2 text-right tabular-nums sm:table-cell">{l.quantity}</td>
                  <td className="py-2 pl-4 text-right tabular-nums">{money(l.priceCents * l.quantity - l.discountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="ml-auto mt-4 w-full max-w-xs space-y-1 text-sm tabular-nums">
          <Row label={t("sf.subtotal")} value={money(order.subtotalCents)} />
          {order.discountCents > 0 && <Row label={order.discountCode ? `${t("checkout.discount")} (${order.discountCode})` : t("checkout.discount")} value={`−${money(order.discountCents)}`} />}
          {(order.shippingTitle || order.shippingCents > 0) && <Row label={order.shippingTitle ? `${t("checkout.shipping")} · ${order.shippingTitle}` : t("checkout.shipping")} value={money(order.shippingCents)} />}
          {!order.taxesIncluded && order.taxCents > 0 && <Row label={t("checkout.tax")} value={money(order.taxCents)} />}
          <div className="flex justify-between border-t border-black/20 pt-2 text-base font-semibold"><dt>{t("common.total")}</dt><dd>{money(order.totalCents)}</dd></div>
          {order.taxesIncluded && order.taxCents > 0 && <p className="text-right text-xs">{t("receipt.vatIncluded", { amount: money(order.taxCents) })}</p>}
          {order.refundedCents > 0 && (
            <>
              <Row label={t("orders.refunded")} value={`−${money(order.refundedCents)}`} />
              <Row label={t("receipt.netPaid")} value={money(order.totalCents - order.refundedCents)} strong />
            </>
          )}
        </dl>

        <section className="mt-8">
          <h2 className="mb-2 text-sm font-semibold">{t("receipt.vatSummary")}</h2>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-black/20 text-left"><th className="py-1.5 font-semibold">{t("receipt.rate")}</th><th className="py-1.5 text-right font-semibold">{t("receipt.taxableBase")}</th><th className="py-1.5 text-right font-semibold">{t("receipt.vat")}</th></tr></thead>
            <tbody>
              {vat.map((r) => (
                <tr key={r.rateBps} className="border-b border-black/10">
                  <td className="py-1.5">{r.rateBps ? pct(r.rateBps) : t("receipt.exempt")}</td>
                  <td className="py-1.5 text-right tabular-nums">{money(r.baseCents)}</td>
                  <td className="py-1.5 text-right tabular-nums">{money(r.taxCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <p className="mt-6 text-sm"><span className="font-semibold">{t("orders.payment")}:</span> {t(`checkout.method.${order.paymentMethod as "cod"}`)}</p>
        <p className="mt-10 border-t border-black/10 pt-4 text-center text-xs text-black/70">{t("receipt.disclaimer")}{store.email ? ` · ${store.email}` : ""}</p>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div className={`flex justify-between gap-4 ${strong ? "font-semibold" : ""}`}><dt>{label}</dt><dd>{value}</dd></div>;
}
