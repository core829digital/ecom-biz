import Link from "next/link";
import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { PageHeader } from "@/components/ui/primitives";

export default async function SettingsPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  await requireStoreAccess(slug);
  const { t } = await getPlatformT();
  const b = `/admin/${slug}/settings`;
  const items = [
    ["general", "nav.general", "settings.general.desc"],
    ["payments", "nav.payments", "settings.payments.desc"],
    ["shipping", "nav.shipping", "settings.shipping.desc"],
    ["taxes", "nav.taxes", "settings.taxes.desc"],
    ["checkout", "nav.checkout", "settings.checkout.desc"],
    ["staff", "nav.staff", "settings.staff.desc"],
    ["billing", "nav.billing", "settings.billing.desc"],
    ["developers", "nav.developers", "settings.developers.desc"],
  ] as const;
  return (
    <>
      <PageHeader title={t("nav.settings")} />
      <ul className="grid gap-4 sm:grid-cols-2">
        {items.map(([href, title, desc]) => (
          <li key={href}>
            <Link href={`${b}/${href}`} className="block h-full rounded-xl border border-border bg-surface p-5 shadow-sm hover:bg-surface-2">
              <p className="font-semibold">{t(title)}</p>
              <p className="mt-1 text-sm text-muted">{t(desc)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
