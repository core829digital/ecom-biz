import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { storePublicUrl } from "@/lib/tenant";
import { PageHeader } from "@/components/ui/primitives";
import { BackLink } from "@/components/admin/back-link";
import { ProductEditor } from "../editor";
import { emptyVariant } from "../editor-types";
import { saveProductAction, uploadImageAction } from "../actions";

export default async function NewProductPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const { store } = await requireStoreAccess(slug);
  const { t } = await getPlatformT();
  const collections = await db.collection.findMany({ where: { storeId: store.id, type: "MANUAL" }, select: { id: true, title: true }, orderBy: { title: "asc" } });
  return (
    <>
      <PageHeader back={<BackLink href={`/admin/${slug}/products`} label={t("nav.products")} />} title={t("products.add")} />
      <ProductEditor
        action={saveProductAction.bind(null, slug, null)}
        uploadImage={uploadImageAction.bind(null, slug)}
        collections={collections}
        currency={store.currency}
        storefrontUrl={await storePublicUrl(store)}
        initial={{
          title: "", handle: "", description: "", status: "DRAFT", vendor: "", productType: "", tags: [],
          seoTitle: "", seoDescription: "", images: [], options: [], variants: [emptyVariant()], collectionIds: [],
        }}
      />
    </>
  );
}
