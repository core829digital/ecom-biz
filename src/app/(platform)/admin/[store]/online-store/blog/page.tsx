import Link from "next/link";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { Badge, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { LinkButton } from "@/components/ui/button";
import { BackLink } from "@/components/admin/back-link";

export default async function BlogList({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const { store } = await requireStoreAccess(slug);
  const { t, locale } = await getPlatformT();
  const base = `/admin/${slug}/online-store/blog`;
  const posts = await db.blogPost.findMany({ where: { storeId: store.id }, orderBy: [{ publishedAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }] });
  const date = new Intl.DateTimeFormat(locale === "it" ? "it-IT" : "en-GB", { dateStyle: "medium", timeZone: store.timezone });
  return (
    <>
      <PageHeader back={<BackLink href={`/admin/${slug}/online-store`} label={t("nav.onlineStore")} />} title={t("nav.blog")} subtitle={t("blog.subtitle")} actions={<LinkButton href={`${base}/new`} size="sm">{t("blog.add")}</LinkButton>} />
      <Card className="[&>div]:p-0">
        {posts.length === 0 ? <EmptyState title={t("blog.empty.title")} description={t("blog.empty.description")} action={<LinkButton href={`${base}/new`}>{t("blog.add")}</LinkButton>} /> : (
          <Table>
            <thead><tr><Th>{t("products.field.title")}</Th><Th>{t("common.status")}</Th><Th>{t("blog.date")}</Th></tr></thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id} className="hover:bg-surface-2/50">
                  <Td><Link href={`${base}/${p.id}`} className="font-medium hover:underline">{p.title}</Link><span className="block text-xs text-muted">/blog/{p.handle}</span></Td>
                  <Td><Badge tone={p.published ? "success" : "neutral"}>{p.published ? t("collections.published") : t("legalPages.draft")}</Badge></Td>
                  <Td className="text-muted">{p.publishedAt ? date.format(p.publishedAt) : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
