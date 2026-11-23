import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { PageHeader } from "@/components/ui/primitives";
import { BackLink } from "@/components/admin/back-link";
import { PageForm } from "../form";
import { savePageAction } from "../actions";

export default async function NewPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  await requireStoreAccess(slug);
  const { t } = await getPlatformT();
  return (
    <>
      <PageHeader back={<BackLink href={`/admin/${slug}/online-store/pages`} label={t("nav.pages")} />} title={t("pages.add")} />
      <PageForm action={savePageAction.bind(null, slug, null)} t={t} />
    </>
  );
}
