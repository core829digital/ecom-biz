import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStoreAccess, hasRole } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { centsToInput } from "@/lib/money";
import { storePublicUrl } from "@/lib/tenant";
import { Badge, PageHeader } from "@/components/ui/primitives";
import { BackLink } from "@/components/admin/back-link";
import { ConfirmSubmit } from "@/components/ui/form";
import { ProductEditor } from "../editor";
import { deleteProductAction, duplicateProductAction, saveProductAction, uploadImageAction } from "../actions";

export default async function EditProductPage({ params, searchParams }: { params: Promise<{ store: string; id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { store: slug, id } = await params;
  const { created } = await searchParams;
  const { store, role } = await requireStoreAccess(slug);
  const { t } = await getPlatformT();
  const product = await db.product.findFirst({
    where: { id, storeId: store.id },
    include: {
      options: { orderBy: { position: "asc" } },
      images: { orderBy: { position: "asc" } },
      variants: { orderBy: { position: "asc" } },
      collections: { select: { collectionId: true } },
    },
  });
  if (!product) notFound();
  const collections = await db.collection.findMany({ where: { storeId: store.id, type: "MANUAL" }, select: { id: true, title: true }, orderBy: { title: "asc" } });
  const storeUrl = await storePublicUrl(store);

  return (
    <>
      <PageHeader
        back={<BackLink href={`/admin/${slug}/products`} label={t("nav.products")} />}
        title={<span className="flex items-center gap-3">{product.title}{created && <Badge tone="success">{t("products.created")}</Badge>}</span>}
        actions={
          <>
            {product.status === "ACTIVE" && (
              <a href={`${storeUrl}/products/${product.handle}`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-2">
                {t("common.view")} ↗
              </a>
            )}
            <form action={duplicateProductAction.bind(null, slug, product.id)}>
              <ConfirmSubmit>{t("products.duplicate")}</ConfirmSubmit>
            </form>
            {hasRole(role, "ADMIN") && (
              <form action={deleteProductAction.bind(null, slug, product.id)}>
                <ConfirmSubmit variant="danger" confirmMessage={t("common.confirmDelete")}>{t("common.delete")}</ConfirmSubmit>
              </form>
            )}
          </>
        }
      />
      <ProductEditor
        action={saveProductAction.bind(null, slug, product.id)}
        uploadImage={uploadImageAction.bind(null, slug)}
        collections={collections}
        currency={store.currency}
        storefrontUrl={storeUrl}
        initial={{
          title: product.title,
          handle: product.handle,
          description: product.description,
          status: product.status,
          vendor: product.vendor ?? "",
          productType: product.productType ?? "",
          tags: product.tags,
          seoTitle: product.seoTitle ?? "",
          seoDescription: product.seoDescription ?? "",
          images: product.images.map((i) => ({ url: i.url, alt: i.alt ?? "" })),
          options: product.options.map((o) => ({ name: o.name, values: o.values })),
          collectionIds: product.collections.map((c) => c.collectionId),
          variants: product.variants.map((v) => ({
            id: v.id,
            option1: v.option1,
            option2: v.option2,
            option3: v.option3,
            price: centsToInput(v.priceCents),
            compareAt: centsToInput(v.compareAtCents),
            cost: centsToInput(v.costCents),
            sku: v.sku ?? "",
            barcode: v.barcode ?? "",
            trackInventory: v.trackInventory,
            inventoryQty: v.inventoryQty,
            allowBackorder: v.allowBackorder,
            requiresShipping: v.requiresShipping,
            taxable: v.taxable,
            weightGrams: v.weightGrams,
          })),
        }}
      />
    </>
  );
}
