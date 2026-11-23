import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { Card, PageHeader } from "@/components/ui/primitives";
import { BackLink } from "@/components/admin/back-link";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/fields";
import { saveCheckoutSettingsAction } from "../actions";

export default async function CheckoutSettings({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  return (
    <>
      <PageHeader back={<BackLink href={`/admin/${slug}/settings`} label={t("nav.settings")} />} title={t("nav.checkout")} />
      <ActionForm action={saveCheckoutSettingsAction.bind(null, slug)}>
        <Card title={t("settings.checkout.customerInfo")}>
          <Checkbox name="requirePhone" label={t("settings.checkout.requirePhone")} hint={t("settings.checkout.requirePhoneHint")} defaultChecked={store.checkoutRequirePhone} />
          <div className="mt-4 flex justify-end"><SubmitButton>{t("common.save")}</SubmitButton></div>
        </Card>
      </ActionForm>
    </>
  );
}
