import { loadStorefront } from "@/server/storefront";
import { HomeSections } from "@/components/storefront/sections";

export default async function StoreHome({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const sf = await loadStorefront(site);
  return <HomeSections sf={sf} site={site} sections={sf.theme.sections} />;
}
