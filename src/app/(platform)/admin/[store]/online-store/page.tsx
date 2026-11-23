import Link from "next/link";
import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { storePublicUrl } from "@/lib/tenant";
import { PageHeader } from "@/components/ui/primitives";

export default async function OnlineStorePage({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const { store } = await requireStoreAccess(slug);
  const { t } = await getPlatformT();
  const url = await storePublicUrl(store);
  const base = `/admin/${slug}/online-store`;
  const items = [
    { href: `${base}/theme`, title: t("nav.theme"), desc: t("onlineStore.theme.desc") },
    { href: `${base}/pages`, title: t("nav.pages"), desc: t("onlineStore.pages.desc") },
    { href: `${base}/navigation`, title: t("nav.navigation"), desc: t("onlineStore.navigation.desc") },
    { href: `${base}/domains`, title: t("nav.domains"), desc: t("onlineStore.domains.desc") },
  ];
  return (
    <>
      <PageHeader title={t("nav.onlineStore")} subtitle={<a href={url} target="_blank" rel="noreferrer" className="underline">{url} ↗</a>} />
      <ul className="grid gap-4 sm:grid-cols-2">
        {items.map((i) => (
          <li key={i.href}>
            <Link href={i.href} className="block h-full rounded-xl border border-border bg-surface p-5 shadow-sm hover:bg-surface-2">
              <p className="font-semibold">{i.title}</p>
              <p className="mt-1 text-sm text-muted">{i.desc}</p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
