import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { countryOptions, CURRENCIES } from "@/lib/geo";
import { LOCALES, LOCALE_LABELS } from "@/lib/i18n";
import { Card, PageHeader } from "@/components/ui/primitives";
import { BackLink } from "@/components/admin/back-link";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Input, Select, Textarea } from "@/components/ui/fields";
import { saveGeneralAction } from "../actions";

export default async function GeneralSettings({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const { t, locale } = await getPlatformT();
  return (
    <>
      <PageHeader back={<BackLink href={`/admin/${slug}/settings`} label={t("nav.settings")} />} title={t("nav.general")} />
      <ActionForm action={saveGeneralAction.bind(null, slug)} className="space-y-5">
        <Card title={t("settings.general.details")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input name="name" label={t("field.storeName")} defaultValue={store.name} required />
            <Input name="email" type="email" label={t("field.contactEmail")} defaultValue={store.email} hint={t("settings.general.emailHint")} required />
            <Input name="phone" label={t("checkout.phone")} defaultValue={store.phone ?? ""} />
          </div>
        </Card>
        <Card title={t("settings.general.legal")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input name="legalName" label={t("settings.general.legalName")} defaultValue={store.legalName ?? ""} />
            <Input name="vatNumber" label={t("settings.general.vatNumber")} defaultValue={store.vatNumber ?? ""} />
            <Input name="address1" label={t("checkout.address1")} defaultValue={store.address1 ?? ""} wrapperClassName="sm:col-span-2" />
            <Input name="address2" label={t("checkout.address2")} defaultValue={store.address2 ?? ""} wrapperClassName="sm:col-span-2" />
            <Input name="zip" label={t("checkout.zip")} defaultValue={store.zip ?? ""} />
            <Input name="city" label={t("checkout.city")} defaultValue={store.city ?? ""} />
            <Input name="province" label={t("checkout.province")} defaultValue={store.province ?? ""} />
            <Select name="countryCode" label={t("field.country")} defaultValue={store.countryCode}>
              {countryOptions(locale).map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </Select>
          </div>
        </Card>
        <Card title={t("settings.general.standards")}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Select name="currency" label={t("field.currency")} defaultValue={store.currency}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Select name="locale" label={t("field.storeLanguage")} defaultValue={store.locale}>
              {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_LABELS[l]}</option>)}
            </Select>
            <Input name="timezone" label={t("settings.general.timezone")} defaultValue={store.timezone} />
          </div>
        </Card>
        <Card title={t("products.seo")}>
          <div className="space-y-4">
            <Input name="seoTitle" label={t("products.field.seoTitle")} maxLength={70} defaultValue={store.seoTitle ?? ""} />
            <Textarea name="seoDescription" label={t("products.field.seoDescription")} rows={3} maxLength={320} defaultValue={store.seoDescription ?? ""} />
          </div>
        </Card>
        <div className="flex justify-end"><SubmitButton>{t("common.save")}</SubmitButton></div>
      </ActionForm>
    </>
  );
}
