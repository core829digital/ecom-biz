import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { env } from "@/lib/env";
import { limitsOf, ownedStoreCount } from "@/server/plans";
import { I18nProvider } from "@/components/i18n-provider";
import { StoreGrid } from "./store-grid";

export const metadata = { title: "Stores" };

export default async function StoresPage() {
  const sessionUser = await requireUser();
  const user = await db.user.findUniqueOrThrow({ where: { id: sessionUser.id }, include: { plan: true } });
  const { t, locale } = await getPlatformT();
  const memberships = await db.membership.findMany({ where: { userId: user.id }, include: { store: true }, orderBy: { createdAt: "asc" } });
  if (memberships.length === 0 && !user.isPlatformAdmin) redirect("/admin/new");
  // One store and nothing else to choose: go straight in.
  if (memberships.length === 1 && !user.isPlatformAdmin && limitsOf(user.plan).stores <= 1) redirect(`/admin/${memberships[0].store.slug}`);
  const pending = await db.order.groupBy({
    by: ["storeId"],
    where: { storeId: { in: memberships.map((m) => m.storeId) }, status: "OPEN", fulfillmentStatus: { not: "FULFILLED" } },
    _count: true,
  });
  const owned = await ownedStoreCount(user.id);
  const limit = limitsOf(user.plan).stores;
  return (
    <I18nProvider locale={locale}>
      <StoreGrid
        platformName={env.platformName}
        userName={user.name}
        isPlatformAdmin={user.isPlatformAdmin}
        canCreate={user.isPlatformAdmin || owned < limit}
        usage={{ owned, limit, plan: user.plan?.name ?? "—" }}
        stores={memberships.map((m) => ({
          slug: m.store.slug,
          name: m.store.name,
          role: t(`role.${m.role}`),
          status: m.store.status,
          pending: pending.find((p) => p.storeId === m.storeId)?._count ?? 0,
        }))}
      />
    </I18nProvider>
  );
}
