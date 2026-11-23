import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { PageHeader } from "@/components/ui/primitives";
import { BackLink } from "@/components/admin/back-link";
import { CollectionEditor } from "../editor";
import { saveCollectionAction } from "../actions";
import { uploadImageAction } from "../../products/actions";

export default async function NewCollectionPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  await requireStoreAccess(slug);
  const { t } = await getPlatformT();
  return (
    <>
      <PageHeader back={<BackLink href={`/admin/${slug}/collections`} label={t("nav.collections")} />} title={t("collections.add")} />
      <CollectionEditor
        isNew
        action={saveCollectionAction.bind(null, slug, null)}
        uploadImage={uploadImageAction.bind(null, slug)}
        initial={{ title: "", handle: "", description: "", imageUrl: "", type: "MANUAL", rules: [], matchAll: true, sortOrder: "manual", published: true, seoTitle: "", seoDescription: "" }}
      />
    </>
  );
}
