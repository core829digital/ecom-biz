import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/money";
import { Badge, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { LinkButton } from "@/components/ui/button";
import { FilterTabs, Pagination, SearchBox, parsePage } from "@/components/admin/list";
import { BulkBar } from "./bulk";

const PER_PAGE = 50;
const STATUS_TONE = { ACTIVE: "success", DRAFT: "neutral", ARCHIVED: "warning" } as const;

export default async function ProductsPage({ params, searchParams }: { params: Promise<{ store: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { store: slug } = await params;
  const sp = await searchParams;
  const { store } = await requireStoreAccess(slug);
  const { t, locale } = await getPlatformT();
  const base = `/admin/${slug}/products`;
  const page = parsePage(sp.page);
  const status = ["ACTIVE", "DRAFT", "ARCHIVED"].includes(sp.status ?? "") ? (sp.status as "ACTIVE") : undefined;
  const q = sp.q?.trim();

  const where: Prisma.ProductWhereInput = {
    storeId: store.id,
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { vendor: { contains: q, mode: "insensitive" } },
            { productType: { contains: q, mode: "insensitive" } },
            { tags: { has: q } },
            { variants: { some: { sku: { contains: q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };
  const [total, products, anyProducts] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { images: { orderBy: { position: "asc" }, take: 1 }, variants: { select: { priceCents: true, inventoryQty: true, trackInventory: true } } },
    }),
    db.product.count({ where: { storeId: store.id } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <>
      <PageHeader
        title={t("nav.products")}
        actions={
          <>
            <LinkButton href={`${base}/import`} variant="secondary" size="sm">{t("products.import")}</LinkButton>
            <a href={`${base}/export`} className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-2">{t("products.export")}</a>
            <LinkButton href={`${base}/new`} size="sm">{t("products.add")}</LinkButton>
          </>
        }
      />
      {anyProducts === 0 ? (
        <Card>
          <EmptyState title={t("products.empty.title")} description={t("products.empty.description")} action={<LinkButton href={`${base}/new`}>{t("products.add")}</LinkButton>} />
        </Card>
      ) : (
        <section className="rounded-xl border border-border bg-surface shadow-sm">
          <FilterTabs
            basePath={base}
            params={sp}
            name="status"
            options={[
              { value: null, label: t("common.all") },
              { value: "ACTIVE", label: t("products.status.ACTIVE") },
              { value: "DRAFT", label: t("products.status.DRAFT") },
              { value: "ARCHIVED", label: t("products.status.ARCHIVED") },
            ]}
          />
          <SearchBox basePath={base} params={sp} placeholder={t("products.search")} />
          <BulkBar slug={slug}>
            <Table>
              <thead>
                <tr>
                  <Th className="w-10"><span className="sr-only">{t("common.actions")}</span></Th>
                  <Th>{t("products.field.title")}</Th>
                  <Th>{t("common.status")}</Th>
                  <Th>{t("products.inventory")}</Th>
                  <Th>{t("products.field.price")}</Th>
                  <Th>{t("products.field.type")}</Th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const tracked = p.variants.filter((v) => v.trackInventory);
                  const stock = tracked.reduce((s, v) => s + v.inventoryQty, 0);
                  const prices = p.variants.map((v) => v.priceCents);
                  const min = Math.min(...prices), max = Math.max(...prices);
                  return (
                    <tr key={p.id} className="hover:bg-surface-2/50">
                      <Td><input type="checkbox" name="ids" value={p.id} aria-label={p.title} className="size-4" /></Td>
                      <Td>
                        <Link href={`${base}/${p.id}`} className="flex items-center gap-3 font-medium hover:underline">
                          <span className="size-10 shrink-0 overflow-hidden rounded-md border border-border bg-surface-2">
                            {p.images[0] && <img src={p.images[0].url} alt="" className="size-full object-cover" />}
                          </span>
                          {p.title}
                        </Link>
                      </Td>
                      <Td><Badge tone={STATUS_TONE[p.status]}>{t(`products.status.${p.status}`)}</Badge></Td>
                      <Td className={stock <= 0 && tracked.length ? "text-danger" : "text-muted"}>
                        {tracked.length ? t("products.inStock", { count: stock, variants: p.variants.length }) : t("products.notTracked")}
                      </Td>
                      <Td className="tabular-nums">
                        {formatMoney(min, store.currency, locale)}{max !== min && ` – ${formatMoney(max, store.currency, locale)}`}
                      </Td>
                      <Td className="text-muted">{p.productType}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            {products.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">{t("products.noResults")}</p>}
          </BulkBar>
          <Pagination basePath={base} params={sp} page={page} pages={pages} labels={{ previous: t("common.previous"), next: t("common.next"), summary: t("common.page", { page, pages }) }} />
        </section>
      )}
    </>
  );
}
