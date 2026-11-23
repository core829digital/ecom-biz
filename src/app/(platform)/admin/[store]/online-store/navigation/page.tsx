import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { Card, PageHeader } from "@/components/ui/primitives";
import { BackLink } from "@/components/admin/back-link";
import { MenuEditor } from "./menu-editor";
import { saveMenuAction } from "./actions";

type Item = { title: string; url: string };
const asItems = (json: unknown): Item[] => (Array.isArray(json) ? json.filter((i): i is Item => typeof i?.title === "string" && typeof i?.url === "string") : []);

export default async function NavigationPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  const [menus, collections, pages, products] = await Promise.all([
    db.menu.findMany({ where: { storeId: store.id } }),
    db.collection.findMany({ where: { storeId: store.id }, select: { title: true, handle: true }, orderBy: { title: "asc" } }),
    db.page.findMany({ where: { storeId: store.id }, select: { title: true, handle: true }, orderBy: { title: "asc" } }),
    db.product.findMany({ where: { storeId: store.id, status: "ACTIVE" }, select: { title: true, handle: true }, orderBy: { title: "asc" }, take: 200 }),
  ]);
  const suggestions: Item[] = [
    { title: t("nav.home"), url: "/" },
    { title: t("sf.allProducts"), url: "/collections/all" },
    { title: t("sf.collections"), url: "/collections" },
    { title: t("sf.search"), url: "/search" },
    { title: t("sf.account"), url: "/account" },
    ...collections.map((c) => ({ title: c.title, url: `/collections/${c.handle}` })),
    ...pages.map((p) => ({ title: p.title, url: `/pages/${p.handle}` })),
    ...products.map((p) => ({ title: p.title, url: `/products/${p.handle}` })),
  ];
  return (
    <>
      <PageHeader back={<BackLink href={`/admin/${slug}/online-store`} label={t("nav.onlineStore")} />} title={t("nav.navigation")} subtitle={t("navigation.subtitle")} />
      <div className="space-y-5">
        {(["main", "footer"] as const).map((handle) => (
          <Card key={handle} title={t(`navigation.menu.${handle}`)}>
            <MenuEditor action={saveMenuAction.bind(null, slug, handle)} initial={asItems(menus.find((m) => m.handle === handle)?.items)} suggestions={suggestions} />
          </Card>
        ))}
      </div>
    </>
  );
}
