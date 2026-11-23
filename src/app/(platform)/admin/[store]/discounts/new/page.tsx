import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { PageHeader } from "@/components/ui/primitives";
import { BackLink } from "@/components/admin/back-link";
import { DiscountForm } from "../form";
import { saveDiscountAction } from "../actions";

export default async function NewDiscount({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  return (
    <>
      <PageHeader back={<BackLink href={`/admin/${slug}/discounts`} label={t("nav.discounts")} />} title={t("discounts.add")} />
      <DiscountForm
        action={saveDiscountAction.bind(null, slug, null)}
        currency={store.currency}
        initial={{ code: "", type: "PERCENTAGE", value: "", minSubtotal: "", usageLimit: "", oncePerCustomer: false, startsAt: "", endsAt: "", active: true }}
      />
    </>
  );
}
