import type { Metadata } from "next";
import { MarketingShell } from "@/components/landing/landing";
import { AboutPage } from "@/components/landing/pages";
import { marketingShell } from "@/server/marketing-site";
import { env } from "@/lib/env";

export async function generateMetadata(): Promise<Metadata> {
  const { shell } = await marketingShell();
  return { title: shell.pages.about.title, description: shell.pages.about.subtitle };
}

export default async function Page() {
  const { shell } = await marketingShell();
  const legal = env.legal;
  return (
    <MarketingShell {...shell}>
      <AboutPage pages={shell.pages} landing={shell.copy} company={legal.configured ? legal.company : null} contactEmail={legal.configured ? legal.email : null} />
    </MarketingShell>
  );
}
