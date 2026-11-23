import { loadStorefront } from "@/server/storefront";

export async function GET(_req: Request, { params }: { params: Promise<{ site: string }> }) {
  const sf = await loadStorefront((await params).site);
  const body = `User-agent: *\nDisallow: /cart\nDisallow: /checkout\nDisallow: /account\nDisallow: /search\nSitemap: ${sf.publicUrl}/sitemap.xml\n`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
