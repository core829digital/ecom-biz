import "server-only";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { landingCopy } from "@/lib/i18n/landing";
import { marketingCopy } from "@/lib/i18n/marketing-pages";
import { getAppearance } from "@/lib/appearance-server";
import { formatMoney } from "@/lib/money";

/** Everything the public marketing pages share: copy, navigation state, operator identity. */
export async function marketingShell() {
  const [user, { t, locale }, { theme }] = await Promise.all([getCurrentUser(), getPlatformT(), getAppearance()]);
  return {
    t,
    shell: {
      copy: landingCopy(locale, env.platformName),
      pages: marketingCopy(locale, env.platformName),
      brand: env.platformName,
      company: env.legal.configured ? { name: env.legal.company, vat: env.legal.vat } : null,
      loggedIn: !!user,
      locale,
      theme,
      themeLabels: { light: t("appearance.light"), dark: t("appearance.dark"), system: t("appearance.system") },
    },
  };
}

/** Active plans as shown on the site (pricing cards and comparison table). */
export async function marketingPlans(locale: string) {
  const plans = await db.plan.findMany({ where: { active: true }, orderBy: { position: "asc" } });
  return plans.map((p) => ({
    id: p.id,
    name: p.name,
    price: formatMoney(p.priceCents, p.currency, locale),
    fee: (p.transactionFeeBps / 100).toFixed(p.transactionFeeBps % 100 ? 1 : 0),
    stores: p.maxStores,
    products: p.maxProducts,
    staff: p.maxStaff,
    storageMb: p.maxStorageMb,
    motion: p.motionLevel,
    css: p.allowCustomCss,
    api: p.allowApi,
    domain: p.allowCustomDomain,
    features: p.features,
  }));
}
export type MarketingPlan = Awaited<ReturnType<typeof marketingPlans>>[number];
