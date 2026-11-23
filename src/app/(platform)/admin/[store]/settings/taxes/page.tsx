import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { countryName, countryOptions } from "@/lib/geo";
import { Card, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { BackLink } from "@/components/admin/back-link";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Checkbox, Input, Select } from "@/components/ui/fields";
import { deleteTaxRateAction, saveTaxRateAction, saveTaxSettingsAction } from "../actions";

export default async function TaxSettings({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const { t, locale } = await getPlatformT();
  const rates = await db.taxRate.findMany({ where: { storeId: store.id }, orderBy: { countryCode: "asc" } });
  return (
    <>
      <PageHeader back={<BackLink href={`/admin/${slug}/settings`} label={t("nav.settings")} />} title={t("nav.taxes")} />
      <div className="space-y-5">
        <ActionForm action={saveTaxSettingsAction.bind(null, slug)}>
          <Card title={t("settings.taxes.calculation")}>
            <div className="space-y-3">
              <Checkbox name="taxesIncluded" label={t("settings.taxes.included")} hint={t("settings.taxes.includedHint")} defaultChecked={store.taxesIncluded} />
              <Checkbox name="taxShipping" label={t("settings.taxes.shipping")} defaultChecked={store.taxShipping} />
            </div>
            <div className="mt-4 flex justify-end"><SubmitButton>{t("common.save")}</SubmitButton></div>
          </Card>
        </ActionForm>
        <Card title={t("settings.taxes.rates")}>
          <p className="mb-4 text-sm text-muted">{t("settings.taxes.ratesHint")}</p>
          {rates.length > 0 && (
            <Table>
              <thead><tr><Th>{t("field.country")}</Th><Th>{t("common.name")}</Th><Th>{t("settings.taxes.rate")}</Th><Th /></tr></thead>
              <tbody>
                {rates.map((r) => (
                  <tr key={r.id}>
                    <Td>{countryName(r.countryCode, locale)}</Td>
                    <Td>{r.name}</Td>
                    <Td className="tabular-nums">{(r.rateBps / 100).toFixed(2)}%</Td>
                    <Td className="text-right"><form action={deleteTaxRateAction.bind(null, slug, r.id)}><button className="text-sm text-danger hover:underline">{t("common.delete")}</button></form></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <ActionForm action={saveTaxRateAction.bind(null, slug)} className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-4 sm:items-end">
            <Select name="countryCode" label={t("field.country")} defaultValue={store.countryCode} wrapperClassName="sm:col-span-2">
              {countryOptions(locale).map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </Select>
            <Input name="name" label={t("common.name")} defaultValue="VAT" />
            <Input name="rate" label={`${t("settings.taxes.rate")} (%)`} inputMode="decimal" placeholder="21" required />
            <div className="flex justify-end sm:col-span-4"><SubmitButton>{t("settings.taxes.saveRate")}</SubmitButton></div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
