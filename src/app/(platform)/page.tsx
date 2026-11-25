import type { Metadata } from "next";
import { getPlatformT } from "@/lib/i18n/server";
import { landingCopy } from "@/lib/i18n/landing";
import { env } from "@/lib/env";
import { Landing } from "@/components/landing/landing";
import { marketingPlans, marketingShell } from "@/server/marketing-site";

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
  const { shell } = await marketingShell();
  return <Landing {...shell} plans={await marketingPlans(shell.locale)} />;
}
