import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { formatAddressLines, type Address } from "@/lib/address";
import { countryName } from "@/lib/geo";
import { PrintButton } from "./print-button";

export default async function PackingSlip({ params }: { params: Promise<{ store: string; id: string }> }) {
  const { store: slug, id } = await params;
  const { store } = await requireStoreAccess(slug);
  const { t, locale } = await getPlatformT();
  const order = await db.order.findFirst({ where: { id, storeId: store.id }, include: { lines: true } });
  if (!order) notFound();
  const to = formatAddressLines(order.shippingAddress as Address, (c) => countryName(c, locale));
  const from = [store.legalName || store.name, store.address1, store.address2, [store.zip, store.city].filter(Boolean).join(" "), countryName(store.countryCode, locale), store.vatNumber]
    .filter((l): l is string => !!l);
  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-white p-8 text-black print:static print:p-0">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-start justify-between print:hidden">
          <a href={`/admin/${slug}/orders/${order.id}`} className="text-sm underline">← {t("common.back")}</a>
          <PrintButton label={t("orders.print")} />
        </div>
        <header className="flex justify-between border-b border-black/20 pb-4">
          <div>
            <h1 className="text-2xl font-semibold">{store.name}</h1>
            <p className="text-sm">{t("orders.packingSlip")}</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">{t("orders.number", { number: order.number })}</p>
            <p>{new Intl.DateTimeFormat(locale === "it" ? "it-IT" : "en-GB", { dateStyle: "long", timeZone: store.timezone }).format(order.createdAt)}</p>
          </div>
        </header>
        <section className="mt-6 grid grid-cols-2 gap-8 text-sm">
          <div><p className="mb-1 font-semibold">{t("orders.shipTo")}</p>{to.map((l, i) => <p key={i}>{l}</p>)}</div>
          <div><p className="mb-1 font-semibold">{t("orders.from")}</p>{from.map((l, i) => <p key={i}>{l}</p>)}</div>
        </section>
        <table className="mt-8 w-full text-sm">
          <thead><tr className="border-b border-black/20 text-left"><th className="py-2">{t("nav.products")}</th><th className="py-2">SKU</th><th className="py-2 text-right">{t("sf.quantity")}</th></tr></thead>
          <tbody>
            {order.lines.filter((l) => l.requiresShipping && l.quantity - l.refundedQty > 0).map((l) => (
              <tr key={l.id} className="border-b border-black/10">
                <td className="py-2">{l.title}{l.variantTitle && <span className="block text-xs">{l.variantTitle}</span>}</td>
                <td className="py-2">{l.sku}</td>
                <td className="py-2 text-right">{l.quantity - l.refundedQty}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {order.note && <p className="mt-6 text-sm"><span className="font-semibold">{t("orders.notes")}:</span> {order.note}</p>}
        <p className="mt-10 text-center text-xs">{store.email}</p>
      </div>
    </div>
  );
}
