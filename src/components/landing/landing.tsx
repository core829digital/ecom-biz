"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { LandingCopy } from "@/lib/i18n/landing";
import type { ThemePref } from "@/lib/appearance";
import { Hero, LandingNav } from "./hero";
import { Compare, Faq, Features, FinalCta, Footer, HowItWorks, Marquee, Pricing, Stats, type LandingPlan } from "./sections";
import { setLocaleAction } from "./actions";

export function Landing({ copy, brand, loggedIn, plans, theme, themeLabels, locale }: {
  copy: LandingCopy; brand: string; loggedIn: boolean; plans: LandingPlan[]; theme: ThemePref; themeLabels: Record<ThemePref, string>; locale: string;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const onLocale = (l: "en" | "it") => start(async () => { await setLocaleAction(l); router.refresh(); });
  return (
    <div className="overflow-x-clip">
      <LandingNav copy={copy} brand={brand} loggedIn={loggedIn} theme={theme} themeLabels={themeLabels} locale={locale} onLocale={onLocale} />
      <main>
        <Hero copy={copy} />
        <Marquee items={copy.marquee} />
        <Stats stats={copy.stats} />
        <Features copy={copy.features} mock={copy.mock} />
        <HowItWorks copy={copy.how} />
        <Compare copy={copy.compare} />
        {plans.length > 0 && <Pricing copy={copy.pricing} plans={plans} />}
        <Faq copy={copy.faq} />
        <FinalCta copy={copy.cta} />
      </main>
      <Footer copy={copy.footer} nav={copy.nav} brand={brand} />
    </div>
  );
}
