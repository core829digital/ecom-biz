import Link from "next/link";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { Badge, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { LinkButton } from "@/components/ui/button";

export default async function CollectionsPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const { store } = await requireStoreAccess(slug);
  const { t } = await getPlatformT();
  const base = `/admin/${slug}/collections`;
  const collections = await db.collection.findMany({
    where: { storeId: store.id },
    orderBy: { title: "asc" },
    include: { _count: { select: { products: true } } },
  });
  return (
    <>
      <PageHeader title={t("nav.collections")} actions={<LinkButton href={`${base}/new`} size="sm">{t("collections.add")}</LinkButton>} />
      <Card className="[&>div]:p-0">
        {collections.length === 0 ? (
          <EmptyState title={t("collections.empty.title")} description={t("collections.empty.description")} action={<LinkButton href={`${base}/new`}>{t("collections.add")}</LinkButton>} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t("products.field.title")}</Th>
                <Th>{t("collections.type")}</Th>
                <Th>{t("nav.products")}</Th>
                <Th>{t("collections.visibility")}</Th>
              </tr>
            </thead>
            <tbody>
              {collections.map((c) => (
                <tr key={c.id} className="hover:bg-surface-2/50">
                  <Td>
                    <Link href={`${base}/${c.id}`} className="flex items-center gap-3 font-medium hover:underline">
                      <span className="size-10 shrink-0 overflow-hidden rounded-md border border-border bg-surface-2">{c.imageUrl && <img src={c.imageUrl} alt="" className="size-full object-cover" />}</span>
                      {c.title}
                    </Link>
                  </Td>
                  <Td className="text-muted">{t(`collections.type.${c.type}`)}</Td>
                  <Td className="text-muted">{c.type === "MANUAL" ? c._count.products : t("collections.automatic")}</Td>
                  <Td><Badge tone={c.published ? "success" : "neutral"}>{c.published ? t("collections.published") : t("collections.hidden")}</Badge></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
