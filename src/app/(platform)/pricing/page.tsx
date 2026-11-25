import type { Metadata } from "next";
import { MarketingShell } from "@/components/landing/landing";
import { PricingPage } from "@/components/landing/pages";
import { marketingPlans, marketingShell } from "@/server/marketing-site";

export async function generateMetadata(): Promise<Metadata> {
  const { shell } = await marketingShell();
  return { title: shell.pages.pricing.title, description: shell.pages.pricing.subtitle };
}

export default async function Page() {
  const { shell } = await marketingShell();
  return <MarketingShell {...shell}><PricingPage pages={shell.pages} landing={shell.copy} plans={await marketingPlans(shell.locale)} /></MarketingShell>;
}
