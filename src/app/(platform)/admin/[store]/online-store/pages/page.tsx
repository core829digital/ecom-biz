import Link from "next/link";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { Badge, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { LinkButton } from "@/components/ui/button";
import { BackLink } from "@/components/admin/back-link";

export default async function PagesList({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const { store } = await requireStoreAccess(slug);
  const { t } = await getPlatformT();
  const base = `/admin/${slug}/online-store/pages`;
  const pages = await db.page.findMany({ where: { storeId: store.id }, orderBy: { title: "asc" } });
  return (
    <>
      <PageHeader back={<BackLink href={`/admin/${slug}/online-store`} label={t("nav.onlineStore")} />} title={t("nav.pages")} actions={<LinkButton href={`${base}/new`} size="sm">{t("pages.add")}</LinkButton>} />
      <Card className="[&>div]:p-0">
        {pages.length === 0 ? <EmptyState title={t("pages.empty.title")} description={t("pages.empty.description")} action={<LinkButton href={`${base}/new`}>{t("pages.add")}</LinkButton>} /> : (
          <Table>
            <thead><tr><Th>{t("products.field.title")}</Th><Th>URL</Th><Th>{t("collections.visibility")}</Th></tr></thead>
            <tbody>
              {pages.map((p) => (
                <tr key={p.id} className="hover:bg-surface-2/50">
                  <Td><Link href={`${base}/${p.id}`} className="font-medium hover:underline">{p.title}</Link></Td>
                  <Td className="text-muted">/pages/{p.handle}</Td>
                  <Td><Badge tone={p.published ? "success" : "neutral"}>{p.published ? t("collections.published") : t("collections.hidden")}</Badge></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
