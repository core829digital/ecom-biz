import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/money";
import { Card, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { BackLink } from "@/components/admin/back-link";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/ui/form";
import { Input } from "@/components/ui/fields";
import { ZoneForm } from "../zone-form";
import { addRateAction, deleteRateAction, deleteZoneAction, saveZoneAction } from "../../actions";

export default async function ZonePage({ params }: { params: Promise<{ store: string; zoneId: string }> }) {
  const { store: slug, zoneId } = await params;
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const { t, locale } = await getPlatformT();
  const zone = await db.shippingZone.findFirst({ where: { id: zoneId, storeId: store.id }, include: { rates: { orderBy: { priceCents: "asc" } } } });
  if (!zone) notFound();
  const money = (c: number | null) => (c === null ? "—" : formatMoney(c, store.currency, locale));
  return (
    <>
      <PageHeader
        back={<BackLink href={`/admin/${slug}/settings/shipping`} label={t("nav.shipping")} />}
        title={zone.name}
        actions={<form action={deleteZoneAction.bind(null, slug, zone.id)}><ConfirmSubmit variant="danger" confirmMessage={t("common.confirmDelete")}>{t("common.delete")}</ConfirmSubmit></form>}
      />
      <div className="space-y-5">
        <Card title={t("settings.shipping.rates")}>
          {zone.rates.length > 0 && (
            <Table>
              <thead><tr><Th>{t("common.name")}</Th><Th>{t("products.field.price")}</Th><Th>{t("settings.shipping.min")}</Th><Th>{t("settings.shipping.max")}</Th><Th /></tr></thead>
              <tbody>
                {zone.rates.map((r) => (
                  <tr key={r.id}>
                    <Td>{r.name}</Td>
                    <Td className="tabular-nums">{r.priceCents ? money(r.priceCents) : t("checkout.free")}</Td>
                    <Td className="tabular-nums text-muted">{money(r.minSubtotalCents)}</Td>
                    <Td className="tabular-nums text-muted">{money(r.maxSubtotalCents)}</Td>
                    <Td className="text-right"><form action={deleteRateAction.bind(null, slug, zone.id, r.id)}><button className="text-sm text-danger hover:underline">{t("common.delete")}</button></form></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <ActionForm action={addRateAction.bind(null, slug, zone.id)} resetOnSuccess className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-5 sm:items-end">
            <Input name="name" label={t("common.name")} placeholder={t("settings.shipping.rateNamePlaceholder")} wrapperClassName="sm:col-span-2" required />
            <Input name="price" label={`${t("products.field.price")} (${store.currency})`} inputMode="decimal" placeholder="0.00" required />
            <Input name="min" label={t("settings.shipping.min")} inputMode="decimal" placeholder={t("common.optional")} />
            <Input name="max" label={t("settings.shipping.max")} inputMode="decimal" placeholder={t("common.optional")} />
            <div className="sm:col-span-5 flex items-center justify-between gap-3">
              <p className="text-xs text-muted">{t("settings.shipping.conditionsHint")}</p>
              <SubmitButton>{t("settings.shipping.addRate")}</SubmitButton>
            </div>
          </ActionForm>
        </Card>
        <Card title={t("common.edit")}>
          <ZoneForm action={saveZoneAction.bind(null, slug, zone.id)} initial={{ name: zone.name, countries: zone.countries }} />
        </Card>
      </div>
    </>
  );
}
