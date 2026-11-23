import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStoreAccess, hasRole } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { storePublicUrl } from "@/lib/tenant";
import { PageHeader } from "@/components/ui/primitives";
import { BackLink } from "@/components/admin/back-link";
import { ConfirmSubmit } from "@/components/ui/form";
import { PageForm } from "../form";
import { deletePageAction, savePageAction } from "../actions";

export default async function EditPage({ params }: { params: Promise<{ store: string; id: string }> }) {
  const { store: slug, id } = await params;
  const { store, role } = await requireStoreAccess(slug);
  const { t } = await getPlatformT();
  const page = await db.page.findFirst({ where: { id, storeId: store.id } });
  if (!page) notFound();
  const url = `${await storePublicUrl(store)}/pages/${page.handle}`;
  return (
    <>
      <PageHeader
        back={<BackLink href={`/admin/${slug}/online-store/pages`} label={t("nav.pages")} />}
        title={page.title}
        actions={
          <>
            {page.published && <a href={url} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-2">{t("common.view")} ↗</a>}
            {hasRole(role, "ADMIN") && <form action={deletePageAction.bind(null, slug, page.id)}><ConfirmSubmit variant="danger" confirmMessage={t("common.confirmDelete")}>{t("common.delete")}</ConfirmSubmit></form>}
          </>
        }
      />
      <PageForm action={savePageAction.bind(null, slug, page.id)} page={page} t={t} />
    </>
  );
}
