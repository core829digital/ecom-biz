import Link from "next/link";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { env } from "@/lib/env";
import { storePublicUrl } from "@/lib/tenant";
import { getAppearance } from "@/lib/appearance-server";
import { accountActive, assertCanCreateStore, PlanLimitError, storeUsage } from "@/server/plans";
import { AdminShell, type NavItem } from "@/components/admin/sidebar";
import { UsageMeter } from "@/components/admin/usage-meter";
import { CommandPalette } from "@/components/admin/command-palette";
import { I18nProvider } from "@/components/i18n-provider";
import { logoutAction } from "../../(auth)/actions";

export default async function StoreAdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const { user, store } = await requireStoreAccess(slug);
  const { t, locale } = await getPlatformT();
  const { theme } = await getAppearance();
  const base = `/admin/${store.slug}`;

  const memberships = await db.membership.findMany({ where: { userId: user.id }, include: { store: { select: { id: true, slug: true, name: true } } }, orderBy: { createdAt: "asc" } });
  const pending = await db.order.groupBy({
    by: ["storeId"],
    where: { storeId: { in: memberships.map((m) => m.storeId) }, status: "OPEN", fulfillmentStatus: { not: "FULFILLED" } },
    _count: true,
  });
  const badgeFor = (id: string) => pending.find((p) => p.storeId === id)?._count ?? 0;
  const me = await db.user.findUniqueOrThrow({ where: { id: user.id }, include: { plan: true } });
  let canCreateStore = true;
  try {
    await assertCanCreateStore(me);
  } catch (e) {
    if (e instanceof PlanLimitError) canCreateStore = false;
    else throw e;
  }
  const usage = await storeUsage(store.id);

  const nav: NavItem[] = [
    { href: base, label: t("nav.home"), icon: "home", exact: true },
    { href: `${base}/orders`, label: t("nav.orders"), icon: "orders", badge: badgeFor(store.id) },
    { href: `${base}/products`, label: t("nav.products"), icon: "products", children: [{ href: `${base}/products/inventory`, label: t("nav.inventory") }] },
    { href: `${base}/collections`, label: t("nav.collections"), icon: "collections" },
    { href: `${base}/customers`, label: t("nav.customers"), icon: "customers" },
    { href: `${base}/discounts`, label: t("nav.discounts"), icon: "discounts" },
    { href: `${base}/online-store`, label: t("nav.onlineStore"), icon: "onlineStore", children: [
      { href: `${base}/online-store/theme`, label: t("nav.theme") },
      { href: `${base}/online-store/pages`, label: t("nav.pages") },
      { href: `${base}/online-store/navigation`, label: t("nav.navigation") },
      { href: `${base}/online-store/domains`, label: t("nav.domains") },
    ] },
    { href: `${base}/settings`, label: t("nav.settings"), icon: "settings", children: [
      { href: `${base}/settings/general`, label: t("nav.general") },
      { href: `${base}/settings/payments`, label: t("nav.payments") },
      { href: `${base}/settings/shipping`, label: t("nav.shipping") },
      { href: `${base}/settings/taxes`, label: t("nav.taxes") },
      { href: `${base}/settings/checkout`, label: t("nav.checkout") },
      { href: `${base}/settings/staff`, label: t("nav.staff") },
      { href: `${base}/settings/developers`, label: t("nav.developers") },
      { href: `${base}/settings/audit`, label: t("nav.audit") },
    ] },
  ];

  const ownerActive = usage.owner ? accountActive(usage.owner) : true;
  const banner = store.status !== "ACTIVE" || (env.billingEnforced && !ownerActive) ? (
    <div className="border-b border-warning/30 bg-warning-bg px-4 py-2 text-center text-sm text-warning">
      {t("admin.banner.paused")} <Link href="/account/billing" className="font-medium underline">{t("nav.billing")}</Link>
    </div>
  ) : null;

  return (
    <I18nProvider locale={locale}>
      <AdminShell
        platformName={env.platformName}
        storeName={store.name}
        storeUrl={await storePublicUrl(store)}
        nav={nav}
        stores={memberships.map((m) => ({ slug: m.store.slug, name: m.store.name, badge: badgeFor(m.store.id) }))}
        currentSlug={store.slug}
        canCreateStore={canCreateStore}
        user={{ name: user.name, email: user.email, isPlatformAdmin: user.isPlatformAdmin }}
        theme={theme}
        banner={banner}
        logoutAction={logoutAction}
        usage={
          <UsageMeter
            title={t("usage.title")}
            planName={usage.plan?.name ?? "—"}
            href="/account/billing"
            rows={[
              { label: t("usage.stores"), used: usage.usage.stores, limit: usage.limits.stores },
              { label: t("usage.products"), used: usage.usage.products, limit: usage.limits.products },
              { label: t("usage.staff"), used: usage.usage.staff, limit: usage.limits.staff },
            ]}
          />
        }
        labels={{
          viewStore: t("nav.viewStore"),
          menu: t("nav.menu"),
          allStores: t("nav.allStores"),
          logout: t("auth.logout"),
          newStore: t("stores.create"),
          search: t("palette.placeholder"),
          account: t("account.title"),
          platform: t("platform.title"),
          storeSettings: t("nav.settings"),
          inviteStaff: t("staff.invite"),
          copyUrl: t("shell.copyUrl"),
          copied: t("developers.copied"),
          limitReached: t("usage.limitStores"),
          theme: { light: t("appearance.light"), dark: t("appearance.dark"), system: t("appearance.system") },
        }}
      >
        {children}
      </AdminShell>
      <CommandPalette slug={store.slug} stores={memberships.map((m) => ({ slug: m.store.slug, name: m.store.name }))} />
    </I18nProvider>
  );
}
