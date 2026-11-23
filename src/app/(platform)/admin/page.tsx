import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { logoutAction } from "../(auth)/actions";

export const metadata = { title: "Stores" };

export default async function StoresPage() {
  const user = await requireUser();
  const { t } = await getPlatformT();
  const memberships = await db.membership.findMany({
    where: { userId: user.id },
    include: { store: true },
    orderBy: { createdAt: "asc" },
  });
  if (memberships.length === 0 && !user.isPlatformAdmin) redirect("/admin/new");
  if (memberships.length === 1 && !user.isPlatformAdmin) redirect(`/admin/${memberships[0].store.slug}`);

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("stores.title")}</h1>
        <div className="flex gap-2">
          {user.isPlatformAdmin && <LinkButton href="/platform" variant="secondary" size="sm">{t("platform.title")}</LinkButton>}
          <LinkButton href="/admin/new" size="sm">{t("stores.create")}</LinkButton>
        </div>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {memberships.map(({ store, role }) => (
          <li key={store.id}>
            <Link href={`/admin/${store.slug}`} className="flex items-center justify-between px-4 py-3 hover:bg-surface-2">
              <span>
                <span className="block font-medium">{store.name}</span>
                <span className="text-sm text-muted">{store.slug}</span>
              </span>
              <Badge>{t(`role.${role}`)}</Badge>
            </Link>
          </li>
        ))}
        {memberships.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">{t("stores.empty")}</li>}
      </ul>
      <form action={logoutAction} className="mt-6 text-center">
        <button className="text-sm text-muted hover:text-text">{t("auth.logout")}</button>
      </form>
    </main>
  );
}
