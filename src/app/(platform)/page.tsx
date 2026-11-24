import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { landingCopy } from "@/lib/i18n/landing";
import { getAppearance } from "@/lib/appearance-server";
import { formatMoney } from "@/lib/money";
import { env } from "@/lib/env";
import { Landing } from "@/components/landing/landing";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getPlatformT();
  const copy = landingCopy(locale, env.platformName);
  return {
    title: { absolute: `${env.platformName} · ${copy.hero.title}` },
    description: copy.hero.subtitle,
    openGraph: { title: copy.hero.title, description: copy.hero.subtitle, siteName: env.platformName, type: "website" },
    robots: { index: true, follow: true },
  };
}

export default async function LandingPage() {
  const [user, { t, locale }, { theme }] = await Promise.all([getCurrentUser(), getPlatformT(), getAppearance()]);
  const plans = await db.plan.findMany({ where: { active: true }, orderBy: { position: "asc" } });
  return (
    <Landing
      copy={landingCopy(locale, env.platformName)}
      brand={env.platformName}
      company={env.legal.configured ? { name: env.legal.company, vat: env.legal.vat } : null}
      loggedIn={!!user}
      locale={locale}
      theme={theme}
      themeLabels={{ light: t("appearance.light"), dark: t("appearance.dark"), system: t("appearance.system") }}
      plans={plans.map((p) => ({
        id: p.id,
        name: p.name,
        price: formatMoney(p.priceCents, p.currency, locale),
        fee: (p.transactionFeeBps / 100).toFixed(p.transactionFeeBps % 100 ? 1 : 0),
        stores: p.maxStores,
        products: p.maxProducts,
        features: p.features,
      }))}
    />
  );
}
