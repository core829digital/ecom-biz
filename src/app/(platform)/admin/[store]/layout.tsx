import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { env } from "@/lib/env";
import { storeIsOperational, storePublicUrl } from "@/lib/tenant";
import { AdminShell, type NavItem } from "@/components/admin/sidebar";
import { logoutAction } from "../../(auth)/actions";

export default async function StoreAdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const { user, store } = await requireStoreAccess(slug);
  const { t } = await getPlatformT();
  const base = `/admin/${store.slug}`;
  const stores = await db.store.findMany({
    where: { memberships: { some: { userId: user.id } } },
    select: { slug: true, name: true },
    orderBy: { name: "asc" },
  });

  const nav: NavItem[] = [
    { href: base, label: t("nav.home"), exact: true },
    { href: `${base}/orders`, label: t("nav.orders") },
    { href: `${base}/products`, label: t("nav.products"), children: [
      { href: `${base}/products/inventory`, label: t("nav.inventory") },
    ] },
    { href: `${base}/collections`, label: t("nav.collections") },
    { href: `${base}/customers`, label: t("nav.customers") },
    { href: `${base}/discounts`, label: t("nav.discounts") },
    { href: `${base}/online-store`, label: t("nav.onlineStore"), children: [
      { href: `${base}/online-store/theme`, label: t("nav.theme") },
      { href: `${base}/online-store/pages`, label: t("nav.pages") },
      { href: `${base}/online-store/navigation`, label: t("nav.navigation") },
      { href: `${base}/online-store/domains`, label: t("nav.domains") },
    ] },
    { href: `${base}/settings`, label: t("nav.settings"), children: [
      { href: `${base}/settings/general`, label: t("nav.general") },
      { href: `${base}/settings/payments`, label: t("nav.payments") },
      { href: `${base}/settings/shipping`, label: t("nav.shipping") },
      { href: `${base}/settings/taxes`, label: t("nav.taxes") },
      { href: `${base}/settings/checkout`, label: t("nav.checkout") },
      { href: `${base}/settings/staff`, label: t("nav.staff") },
      { href: `${base}/settings/billing`, label: t("nav.billing") },
      { href: `${base}/settings/developers`, label: t("nav.developers") },
    ] },
  ];

  const banner = !storeIsOperational(store) ? (
    <div className="border-b border-warning/30 bg-warning-bg px-4 py-2 text-center text-sm text-warning">
      {t("admin.banner.paused")}
    </div>
  ) : null;

  return (
    <AdminShell
      platformName={env.platformName}
      storeName={store.name}
      storeUrl={await storePublicUrl(store)}
      nav={nav}
      stores={stores}
      userName={user.name}
      banner={banner}
      logoutAction={logoutAction}
      labels={{
        viewStore: t("nav.viewStore"),
        menu: t("nav.menu"),
        switchStore: t("nav.switchStore"),
        allStores: t("nav.allStores"),
        logout: t("auth.logout"),
      }}
    >
      {children}
    </AdminShell>
  );
}
