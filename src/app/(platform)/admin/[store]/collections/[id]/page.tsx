import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStoreAccess, hasRole } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { parseRules } from "@/lib/collections";
import { collectionProducts } from "@/server/catalog";
import { storePublicUrl } from "@/lib/tenant";
import { Card, PageHeader } from "@/components/ui/primitives";
import { BackLink } from "@/components/admin/back-link";
import { ConfirmSubmit } from "@/components/ui/form";
import { inputClass } from "@/components/ui/fields";
import { CollectionEditor } from "../editor";
import {
  addProductToCollectionAction,
  deleteCollectionAction,
  moveProductInCollectionAction,
  removeProductFromCollectionAction,
  saveCollectionAction,
} from "../actions";
import { uploadImageAction } from "../../products/actions";

export default async function EditCollectionPage({ params, searchParams }: { params: Promise<{ store: string; id: string }>; searchParams: Promise<{ add?: string }> }) {
  const { store: slug, id } = await params;
  const { add } = await searchParams;
  const { store, role } = await requireStoreAccess(slug);
  const { t } = await getPlatformT();
  const collection = await db.collection.findFirst({ where: { id, storeId: store.id } });
  if (!collection) notFound();
  const base = `/admin/${slug}/collections/${id}`;

  const manualProducts =
    collection.type === "MANUAL"
      ? await db.collectionProduct.findMany({
          where: { collectionId: id },
          orderBy: [{ position: "asc" }, { productId: "asc" }],
          include: { product: { select: { id: true, title: true, status: true, images: { take: 1, orderBy: { position: "asc" } } } } },
        })
      : [];
  const smartPreview = collection.type === "SMART" ? await collectionProducts(collection, { perPage: 12 }) : null;
  const q = add?.trim();
  const searchResults =
    collection.type === "MANUAL" && q
      ? await db.product.findMany({
          where: { storeId: store.id, title: { contains: q, mode: "insensitive" }, collections: { none: { collectionId: id } } },
          take: 10,
          select: { id: true, title: true },
        })
      : [];
  const storeUrl = await storePublicUrl(store);

  return (
    <>
      <PageHeader
        back={<BackLink href={`/admin/${slug}/collections`} label={t("nav.collections")} />}
        title={collection.title}
        actions={
          <>
            {collection.published && (
              <a href={`${storeUrl}/collections/${collection.handle}`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-2">{t("common.view")} ↗</a>
            )}
            {hasRole(role, "ADMIN") && (
              <form action={deleteCollectionAction.bind(null, slug, id)}>
                <ConfirmSubmit variant="danger" confirmMessage={t("common.confirmDelete")}>{t("common.delete")}</ConfirmSubmit>
              </form>
            )}
          </>
        }
      />
      <CollectionEditor
        isNew={false}
        action={saveCollectionAction.bind(null, slug, id)}
        uploadImage={uploadImageAction.bind(null, slug)}
        initial={{
          title: collection.title,
          handle: collection.handle,
          description: collection.description,
          imageUrl: collection.imageUrl ?? "",
          type: collection.type,
          rules: parseRules(collection.rules),
          matchAll: collection.matchAll,
          sortOrder: collection.sortOrder,
          published: collection.published,
          seoTitle: collection.seoTitle ?? "",
          seoDescription: collection.seoDescription ?? "",
        }}
      />

      <Card className="mt-5" title={t("nav.products")}>
        {collection.type === "MANUAL" ? (
          <>
            <form className="mb-3 flex gap-2" action={base}>
              <input name="add" defaultValue={q} placeholder={t("collections.searchToAdd")} aria-label={t("collections.searchToAdd")} className={inputClass} />
            </form>
            {searchResults.length > 0 && (
              <ul className="mb-4 divide-y divide-border rounded-lg border border-border">
                {searchResults.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    {p.title}
                    <form action={addProductToCollectionAction.bind(null, slug, id, p.id)}>
                      <ConfirmSubmit>{t("common.add")}</ConfirmSubmit>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            {q && searchResults.length === 0 && <p className="mb-4 text-sm text-muted">{t("products.noResults")}</p>}
            {manualProducts.length === 0 ? (
              <p className="text-sm text-muted">{t("collections.noProducts")}</p>
            ) : (
              <ol className="divide-y divide-border">
                {manualProducts.map(({ product }, i) => (
                  <li key={product.id} className="flex items-center gap-3 py-2 text-sm">
                    <span className="w-6 text-right text-muted tabular-nums">{i + 1}.</span>
                    <span className="size-9 shrink-0 overflow-hidden rounded border border-border bg-surface-2">{product.images[0] && <img src={product.images[0].url} alt="" className="size-full object-cover" />}</span>
                    <Link href={`/admin/${slug}/products/${product.id}`} className="flex-1 hover:underline">{product.title}</Link>
                    {product.status !== "ACTIVE" && <span className="text-xs text-muted">{t(`products.status.${product.status}`)}</span>}
                    <form action={moveProductInCollectionAction.bind(null, slug, id, product.id, -1)}><button className="px-1.5 text-muted hover:text-text" aria-label="Up" disabled={i === 0}>↑</button></form>
                    <form action={moveProductInCollectionAction.bind(null, slug, id, product.id, 1)}><button className="px-1.5 text-muted hover:text-text" aria-label="Down" disabled={i === manualProducts.length - 1}>↓</button></form>
                    <form action={removeProductFromCollectionAction.bind(null, slug, id, product.id)}><button className="text-danger hover:underline">{t("collections.remove")}</button></form>
                  </li>
                ))}
              </ol>
            )}
          </>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted">{t("collections.smartPreview", { count: smartPreview?.total ?? 0 })}</p>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {smartPreview?.products.map((p) => (
                <li key={p.id}>
                  <Link href={`/admin/${slug}/products/${p.id}`} className="block text-sm hover:underline">
                    <span className="mb-1 block aspect-square overflow-hidden rounded-lg border border-border bg-surface-2">{p.images[0] && <img src={p.images[0].url} alt="" className="size-full object-cover" />}</span>
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </>
  );
}
