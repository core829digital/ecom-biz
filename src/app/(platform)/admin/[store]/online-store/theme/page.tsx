import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { parseTheme, FONTS } from "@/lib/theme";
import { storePublicUrl } from "@/lib/tenant";
import { PageHeader } from "@/components/ui/primitives";
import { BackLink } from "@/components/admin/back-link";
import { ThemeEditor } from "./editor";
import { saveThemeAction } from "./actions";
import { uploadImageAction } from "../../products/actions";

export default async function ThemePage({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  const collections = await db.collection.findMany({ where: { storeId: store.id }, select: { id: true, title: true }, orderBy: { title: "asc" } });
  return (
    <>
      <PageHeader
        back={<BackLink href={`/admin/${slug}/online-store`} label={t("nav.onlineStore")} />}
        title={t("nav.theme")}
        actions={<a href={await storePublicUrl(store)} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-2">{t("nav.viewStore")} ↗</a>}
      />
      <ThemeEditor
        initial={parseTheme(store.theme)}
        storeName={store.name}
        fonts={Object.entries(FONTS).map(([value, f]) => ({ value, label: f.label }))}
        collections={collections}
        action={saveThemeAction.bind(null, slug)}
        uploadImage={uploadImageAction.bind(null, slug)}
      />
    </>
  );
}
