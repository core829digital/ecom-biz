"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { LandingCopy } from "@/lib/i18n/landing";
import type { MarketingCopy } from "@/lib/i18n/marketing-pages";
import type { ThemePref } from "@/lib/appearance";
import { Hero, LandingNav } from "./hero";
import { Compare, Faq, Features, FinalCta, Footer, HowItWorks, Marquee, Pricing, Stats, type LandingPlan } from "./sections";
import { setLocaleAction } from "./actions";
import { ScrollProgress } from "./motion-ui";

export type ShellProps = {
  copy: LandingCopy; pages: MarketingCopy; brand: string; loggedIn: boolean; theme: ThemePref; themeLabels: Record<ThemePref, string>; locale: string;
  /** Operator identity for the footer (required on business websites in the EU); null until configured. */
  company: { name: string; vat: string } | null;
};

/** Navigation, reading progress and footer shared by every marketing page. */
export function MarketingShell({ copy, pages, brand, loggedIn, theme, themeLabels, locale, company, children }: ShellProps & { children: React.ReactNode }) {
  const router = useRouter();
  const [, start] = useTransition();
  const onLocale = (l: "en" | "it") => start(async () => { await setLocaleAction(l); router.refresh(); });
  return (
    <div className="overflow-x-clip">
      <ScrollProgress />
      <LandingNav copy={copy} pages={pages.nav} brand={brand} loggedIn={loggedIn} theme={theme} themeLabels={themeLabels} locale={locale} onLocale={onLocale} />
      <main>{children}</main>
      <Footer copy={copy.footer} nav={copy.nav} pages={pages.nav} brand={brand} company={company} />
    </div>
  );
}

export function Landing({ plans, ...shell }: ShellProps & { plans: LandingPlan[] }) {
  const { copy } = shell;
  return (
    <MarketingShell {...shell}>
      <Hero copy={copy} />
      <Marquee items={copy.marquee} />
      <Stats stats={copy.stats} />
      <Features copy={copy.features} mock={copy.mock} />
      <HowItWorks copy={copy.how} />
      <Compare copy={copy.compare} />
      {plans.length > 0 && <Pricing copy={copy.pricing} plans={plans} />}
      <Faq copy={copy.faq} />
      <FinalCta copy={copy.cta} />
    </MarketingShell>
  );
}
