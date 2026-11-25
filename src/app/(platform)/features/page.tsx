import type { Metadata } from "next";
import { MarketingShell } from "@/components/landing/landing";
import { FeaturesPage } from "@/components/landing/pages";
import { marketingShell } from "@/server/marketing-site";

export async function generateMetadata(): Promise<Metadata> {
  const { shell } = await marketingShell();
  return { title: shell.pages.features.title, description: shell.pages.features.subtitle };
}

export default async function Page() {
  const { shell } = await marketingShell();
  return <MarketingShell {...shell}><FeaturesPage pages={shell.pages} landing={shell.copy} /></MarketingShell>;
}
