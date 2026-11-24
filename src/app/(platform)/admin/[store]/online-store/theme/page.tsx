import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { parseTheme, themeDraft, FONTS } from "@/lib/theme";
import { storePublicUrl } from "@/lib/tenant";
import { storeThemeCapabilities } from "@/server/storefront";
import { SiteEditor } from "./editor";
import { discardThemeDraftAction, publishThemeAction, saveThemeDraftAction } from "./actions";
import { uploadImageAction } from "../../products/actions";

export default async function ThemePage({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const [collections, products, storeUrl, caps] = await Promise.all([
    db.collection.findMany({ where: { storeId: store.id }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
    db.product.findMany({ where: { storeId: store.id, status: "ACTIVE" }, select: { id: true, title: true }, orderBy: { title: "asc" }, take: 500 }),
    storePublicUrl(store),
    storeThemeCapabilities(store.id),
  ]);
  const draft = themeDraft(store.theme);
  return (
    <SiteEditor
      initial={draft ?? parseTheme(store.theme)}
      hasDraft={!!draft}
      storeName={store.name}
      backHref={`/admin/${slug}/online-store`}
      previewSrc={`/admin/${slug}/online-store/theme/preview`}
      storeUrl={storeUrl}
      fonts={Object.entries(FONTS).map(([value, f]) => ({ value, label: f.label }))}
      catalog={{ collections, products }}
      caps={caps}
      saveDraft={saveThemeDraftAction.bind(null, slug)}
      publish={publishThemeAction.bind(null, slug)}
      discard={discardThemeDraftAction.bind(null, slug)}
      uploadImage={uploadImageAction.bind(null, slug)}
    />
  );
}
