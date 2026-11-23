import Link from "next/link";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { Card, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { Pagination, SearchBox, parsePage } from "@/components/admin/list";
import { InventoryForm } from "./form";

const PER_PAGE = 100;

export default async function InventoryPage({ params, searchParams }: { params: Promise<{ store: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { store: slug } = await params;
  const sp = await searchParams;
  const { store } = await requireStoreAccess(slug);
  const { t } = await getPlatformT();
  const base = `/admin/${slug}/products/inventory`;
  const page = parsePage(sp.page);
  const q = sp.q?.trim();
  const where = {
    trackInventory: true,
    product: { storeId: store.id, ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}) },
    ...(sp.low === "1" ? { inventoryQty: { lte: 5 } } : {}),
  };
  const [total, variants] = await Promise.all([
    db.productVariant.count({ where }),
    db.productVariant.findMany({
      where,
      include: { product: { select: { id: true, title: true, images: { take: 1, orderBy: { position: "asc" } } } } },
      orderBy: [{ product: { title: "asc" } }, { position: "asc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  return (
    <>
      <PageHeader title={t("nav.inventory")} subtitle={t("inventory.subtitle")} />
      <Card className="overflow-hidden [&>div]:p-0">
        <div className="flex items-center gap-2 pr-3">
          <div className="flex-1"><SearchBox basePath={base} params={sp} placeholder={t("products.search")} /></div>
          <Link href={sp.low === "1" ? base : `${base}?low=1`} className="text-sm text-muted hover:text-text">
            {sp.low === "1" ? t("common.all") : t("inventory.lowStock")}
          </Link>
        </div>
        <InventoryForm slug={slug}>
          <Table>
            <thead>
              <tr>
                <Th>{t("nav.products")}</Th>
                <Th>{t("products.field.sku")}</Th>
                <Th className="w-36">{t("products.field.available")}</Th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={v.id}>
                  <Td>
                    <Link href={`/admin/${slug}/products/${v.product.id}`} className="flex items-center gap-3 hover:underline">
                      <span className="size-9 shrink-0 overflow-hidden rounded border border-border bg-surface-2">
                        {v.product.images[0] && <img src={v.product.images[0].url} alt="" className="size-full object-cover" />}
                      </span>
                      <span>
                        <span className="block font-medium">{v.product.title}</span>
                        {v.title !== "Default" && <span className="text-xs text-muted">{v.title}</span>}
                      </span>
                    </Link>
                  </Td>
                  <Td className="text-muted">{v.sku}</Td>
                  <Td>
                    <input
                      type="number"
                      name={`qty:${v.id}`}
                      defaultValue={v.inventoryQty}
                      aria-label={`${v.product.title} ${v.title}`}
                      className={`w-28 rounded-md border border-border bg-surface px-2 py-1 text-sm tabular-nums ${v.inventoryQty <= 0 ? "text-danger" : ""}`}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {variants.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">{t("products.noResults")}</p>}
        </InventoryForm>
        <Pagination basePath={base} params={sp} page={page} pages={pages} labels={{ previous: t("common.previous"), next: t("common.next"), summary: t("common.page", { page, pages }) }} />
      </Card>
    </>
  );
}
