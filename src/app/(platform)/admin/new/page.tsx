import { requireUser } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { env } from "@/lib/env";
import { countryOptions, CURRENCIES } from "@/lib/geo";
import { LOCALES, LOCALE_LABELS } from "@/lib/i18n";
import { NewStoreForm } from "./form";

export const metadata = { title: "Create store" };

export default async function NewStorePage() {
  const user = await requireUser();
  const { t, locale } = await getPlatformT();
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
