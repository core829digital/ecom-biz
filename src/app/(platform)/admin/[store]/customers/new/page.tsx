import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { PageHeader } from "@/components/ui/primitives";
import { BackLink } from "@/components/admin/back-link";
import { CustomerForm } from "../form";
import { saveCustomerAction } from "../actions";

export default async function NewCustomer({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  await requireStoreAccess(slug);
  const { t } = await getPlatformT();
  return (
    <>
      <PageHeader back={<BackLink href={`/admin/${slug}/customers`} label={t("nav.customers")} />} title={t("customers.add")} />
      <CustomerForm action={saveCustomerAction.bind(null, slug, null)} t={t} />
    </>
  );
}
