import { db } from "@/lib/db";
import { loadStorefront } from "@/server/storefront";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function GET(_req: Request, { params }: { params: Promise<{ site: string }> }) {
  const sf = await loadStorefront((await params).site);
  const id = sf.store.id;
  const [products, collections, pages, posts] = await Promise.all([
    db.product.findMany({ where: { storeId: id, status: "ACTIVE" }, select: { handle: true, updatedAt: true }, take: 50000 }),
    db.collection.findMany({ where: { storeId: id, published: true }, select: { handle: true, updatedAt: true } }),
    db.page.findMany({ where: { storeId: id, published: true }, select: { handle: true, updatedAt: true } }),
    db.blogPost.findMany({ where: { storeId: id, published: true }, select: { handle: true, updatedAt: true }, take: 5000 }),
  ]);
  const urls = [
    { loc: "/", lastmod: undefined as Date | undefined },
    { loc: "/collections/all", lastmod: undefined },
    ...collections.map((c) => ({ loc: `/collections/${c.handle}`, lastmod: c.updatedAt })),
    ...products.map((p) => ({ loc: `/products/${p.handle}`, lastmod: p.updatedAt })),
    ...pages.map((p) => ({ loc: `/pages/${p.handle}`, lastmod: p.updatedAt })),
    ...(posts.length ? [{ loc: "/blog", lastmod: undefined }] : []),
    ...posts.map((p) => ({ loc: `/blog/${p.handle}`, lastmod: p.updatedAt })),
    ...(sf.store.contactEnabled ? [{ loc: "/contact", lastmod: undefined }] : []),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${esc(sf.publicUrl + u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod.toISOString()}</lastmod>` : ""}</url>`)
    .join("\n")}\n</urlset>\n`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
