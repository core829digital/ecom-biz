import Link from "next/link";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/money";
import { countryName, countryOptions } from "@/lib/geo";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { BackLink } from "@/components/admin/back-link";
import { ZoneForm } from "./zone-form";
import { saveZoneAction } from "../actions";

export default async function ShippingSettings({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const { t, locale } = await getPlatformT();
  const zones = await db.shippingZone.findMany({ where: { storeId: store.id }, include: { rates: { orderBy: { priceCents: "asc" } } }, orderBy: { name: "asc" } });
  return (
    <>
      <PageHeader back={<BackLink href={`/admin/${slug}/settings`} label={t("nav.settings")} />} title={t("nav.shipping")} subtitle={t("settings.shipping.subtitle")} />
      <div className="space-y-5">
        {zones.length === 0 && <Card><EmptyState title={t("settings.shipping.empty")} description={t("settings.shipping.emptyDesc")} /></Card>}
        {zones.map((z) => (
          <Card key={z.id} title={z.name} actions={<Link href={`/admin/${slug}/settings/shipping/${z.id}`} className="text-sm font-medium hover:underline">{t("common.edit")}</Link>}>
            <p className="mb-3 text-sm text-muted">
              {z.countries.includes("*") ? t("settings.shipping.restOfWorld") : z.countries.map((c) => countryName(c, locale)).join(", ")}
            </p>
            {z.rates.length ? (
              <ul className="divide-y divide-border text-sm">
                {z.rates.map((r) => (
                  <li key={r.id} className="flex justify-between py-2">
                    <span>{r.name}{(r.minSubtotalCents !== null || r.maxSubtotalCents !== null) && <span className="ml-2 text-muted">({r.minSubtotalCents !== null ? `≥ ${formatMoney(r.minSubtotalCents, store.currency, locale)}` : ""}{r.minSubtotalCents !== null && r.maxSubtotalCents !== null ? ", " : ""}{r.maxSubtotalCents !== null ? `≤ ${formatMoney(r.maxSubtotalCents, store.currency, locale)}` : ""})</span>}</span>
                    <span className="tabular-nums">{r.priceCents ? formatMoney(r.priceCents, store.currency, locale) : t("checkout.free")}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-warning">{t("settings.shipping.noRates")}</p>}
          </Card>
        ))}
        <Card title={t("settings.shipping.addZone")}>
          <ZoneForm action={saveZoneAction.bind(null, slug, null)} countries={countryOptions(locale)} />
        </Card>
      </div>
    </>
  );
}
