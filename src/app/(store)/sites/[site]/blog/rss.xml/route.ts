import { db } from "@/lib/db";
import { loadStorefront } from "@/server/storefront";
import { plainExcerpt } from "@/lib/richtext";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** RSS 2.0 feed of the store's published articles. */
export async function GET(_: Request, { params }: { params: Promise<{ site: string }> }) {
  const sf = await loadStorefront((await params).site);
  const posts = await db.blogPost.findMany({ where: { storeId: sf.store.id, published: true }, orderBy: { publishedAt: "desc" }, take: 50 });
  const items = posts.map((p) => `    <item>
      <title>${esc(p.title)}</title>
      <link>${esc(`${sf.publicUrl}/blog/${p.handle}`)}</link>
      <guid isPermaLink="true">${esc(`${sf.publicUrl}/blog/${p.handle}`)}</guid>
      ${p.publishedAt ? `<pubDate>${p.publishedAt.toUTCString()}</pubDate>` : ""}
      <description>${esc(p.excerpt || plainExcerpt(p.body) || "")}</description>
    </item>`).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${esc(sf.store.name)}</title>
    <link>${esc(`${sf.publicUrl}/blog`)}</link>
    <description>${esc(sf.store.seoDescription || sf.store.name)}</description>
${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=600" } });
}
