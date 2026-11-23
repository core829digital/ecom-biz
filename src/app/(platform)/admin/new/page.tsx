import { requireUser } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { env } from "@/lib/env";
import { countryOptions, CURRENCIES } from "@/lib/geo";
import { LOCALES, LOCALE_LABELS } from "@/lib/i18n";
import { NewStoreForm } from "./form";
import Link from "next/link";
import { db } from "@/lib/db";
import { limitsOf, ownedStoreCount } from "@/server/plans";

export const metadata = { title: "Create store" };

export default async function NewStorePage() {
  const user = await requireUser();
  const { t, locale } = await getPlatformT();
  const account = await db.user.findUniqueOrThrow({ where: { id: user.id }, include: { plan: true } });
  const limit = limitsOf(account.plan).stores;
  if (!user.isPlatformAdmin && (await ownedStoreCount(user.id)) >= limit) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-semibold">{t("usage.limitStores")}</h1>
        <p className="mt-2 text-sm text-muted">{t("usage.limitStoresDetail", { count: limit })}</p>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/admin" className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium">{t("common.back")}</Link>
          <Link href="/account/billing" className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-contrast">{t("billing.choose")}</Link>
        </div>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-xl font-semibold">{t("stores.new.title")}</h1>
      <p className="mb-6 mt-1 text-sm text-muted">{t("stores.new.subtitle")}</p>
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <NewStoreForm
          rootDomain={env.storefrontRootDomain}
          defaultEmail={user.email}
          defaultLocale={locale}
          countries={countryOptions(locale)}
          currencies={CURRENCIES}
          locales={LOCALES.map((l) => ({ value: l, label: LOCALE_LABELS[l] }))}
          labels={{
            name: t("field.storeName"),
            slug: t("field.storeAddress"),
            email: t("field.contactEmail"),
            country: t("field.country"),
            currency: t("field.currency"),
            locale: t("field.storeLanguage"),
            submit: t("stores.create"),
          }}
        />
      </div>
    </main>
  );
}
