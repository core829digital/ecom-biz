import type { Metadata } from "next";
import { MarketingShell } from "@/components/landing/landing";
import { DemoPage } from "@/components/landing/demo";
import { marketingShell } from "@/server/marketing-site";

export async function generateMetadata(): Promise<Metadata> {
  const { shell } = await marketingShell();
  return { title: shell.pages.demo.title, description: shell.pages.demo.subtitle };
}

export default async function Page() {
  const { shell } = await marketingShell();
  return <MarketingShell {...shell}><DemoPage pages={shell.pages} locale={shell.locale} /></MarketingShell>;
}
