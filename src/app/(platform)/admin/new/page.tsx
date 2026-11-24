import { requireUser } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { env } from "@/lib/env";
import { countryFromAcceptLanguage, countryOptions, CURRENCIES, suggestedCurrency } from "@/lib/geo";
import { headers } from "next/headers";
import { Check } from "lucide-react";
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
  const firstStore = (await ownedStoreCount(user.id)) === 0;
  const country = countryFromAcceptLanguage((await headers()).get("accept-language")) ?? (locale === "it" ? "IT" : "RO");
  const steps = [t("onboarding.step.account"), t("onboarding.step.store"), t("onboarding.step.setup")];
  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      {firstStore && (
        <ol className="mb-8 flex items-center gap-2 text-xs" aria-label={t("onboarding.progress")}>
          {steps.map((s, i) => (
            <li key={s} className="flex flex-1 items-center gap-2" aria-current={i === 1 ? "step" : undefined}>
              <span className={`flex size-6 shrink-0 items-center justify-center rounded-full font-semibold ${i === 0 ? "bg-success text-white" : i === 1 ? "bg-accent text-accent-contrast" : "border border-border text-muted"}`}>
                {i === 0 ? <Check className="size-3.5" aria-hidden /> : i + 1}
              </span>
              <span className={i === 1 ? "font-medium" : "text-muted"}>{s}</span>
              {i < steps.length - 1 && <span className="h-px flex-1 bg-border" aria-hidden />}
            </li>
          ))}
        </ol>
      )}
      <h1 className="text-xl font-semibold">{firstStore ? t("onboarding.welcome", { name: user.name.split(" ")[0] }) : t("stores.new.title")}</h1>
      <p className="mb-6 mt-1 text-sm text-muted">{firstStore ? t("onboarding.welcomeBody") : t("stores.new.subtitle")}</p>
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <NewStoreForm
          addressPattern={env.storeAddress("{slug}")}
          defaultEmail={user.email}
          defaultLocale={locale}
          countries={countryOptions(locale)}
          currencies={CURRENCIES}
          defaultCountry={country}
          currencyFor={Object.fromEntries(countryOptions(locale).map((c) => [c.code, suggestedCurrency(c.code)]))}
          locales={LOCALES.map((l) => ({ value: l, label: LOCALE_LABELS[l] }))}
          labels={{
            name: t("field.storeName"),
            slug: t("field.storeAddress"),
            email: t("field.contactEmail"),
            country: t("field.country"),
            currency: t("field.currency"),
            locale: t("field.storeLanguage"),
            submit: t("stores.create"),
            slugExample: t("stores.new.slugExample"),
            continue: t("onboarding.style.continue"),
            back: t("common.back"),
            styleTitle: t("onboarding.style.title"),
            styleBody: t("onboarding.style.body"),
            lookTitle: t("onboarding.style.look"),
            homeTitle: t("onboarding.style.home"),
            styleHint: t("onboarding.style.hint"),
            starters: {
              classic: { name: t("onboarding.starter.classic"), body: t("onboarding.starter.classicBody") },
              editorial: { name: t("onboarding.starter.editorial"), body: t("onboarding.starter.editorialBody") },
              minimal: { name: t("onboarding.starter.minimal"), body: t("onboarding.starter.minimalBody") },
            },
          }}
        />
      </div>
    </main>
  );
}
