import Link from "next/link";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { Badge, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { LinkButton } from "@/components/ui/button";
import { BackLink } from "@/components/admin/back-link";
import { ConfirmSubmit } from "@/components/ui/form";
import { Scale } from "lucide-react";
import { STORE_LEGAL_PAGES } from "@/lib/legal/store-templates";
import { createLegalPageAction } from "./actions";

export default async function PagesList({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const { store } = await requireStoreAccess(slug);
  const { t } = await getPlatformT();
  const base = `/admin/${slug}/online-store/pages`;
  const pages = await db.page.findMany({ where: { storeId: store.id }, orderBy: { title: "asc" } });
  return (
    <>
      <PageHeader back={<BackLink href={`/admin/${slug}/online-store`} label={t("nav.onlineStore")} />} title={t("nav.pages")} actions={<LinkButton href={`${base}/new`} size="sm">{t("pages.add")}</LinkButton>} />
      <Card title={<span className="flex items-center gap-2"><Scale className="size-4" aria-hidden />{t("legalPages.title")}</span>} className="mb-5">
        <p className="mb-4 text-sm text-muted">{t("legalPages.body")}</p>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {STORE_LEGAL_PAGES.map((h) => {
            const page = pages.find((p) => p.handle === h);
            return (
              <li key={h} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
                <span className="min-w-0 flex-1 font-medium">{t(`legalPages.${h}`)}</span>
                {page ? (
                  <>
                    <Badge tone={page.published ? "success" : "warning"}>{page.published ? t("collections.published") : t("legalPages.draft")}</Badge>
                    <Link href={`${base}/${page.id}`} className="text-sm underline">{t("common.edit")}</Link>
                  </>
                ) : (
                  <>
                    <Badge tone="danger">{t("legalPages.missing")}</Badge>
                    <form action={createLegalPageAction.bind(null, slug, h)}><ConfirmSubmit>{t("legalPages.create")}</ConfirmSubmit></form>
                  </>
                )}
              </li>
            );
          })}
        </ul>
        {!store.vatNumber || !store.legalName ? <p className="mt-3 text-xs text-warning">{t("legalPages.completeDetails")} <Link href={`/admin/${slug}/settings/general`} className="underline">{t("nav.general")}</Link></p> : null}
      </Card>
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
