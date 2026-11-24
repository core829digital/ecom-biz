import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { loadStorefront } from "@/server/storefront";

export async function generateMetadata({ params }: { params: Promise<{ site: string }> }): Promise<Metadata> {
  const sf = await loadStorefront((await params).site);
  return {
    title: sf.t("sf.blog.title"),
    alternates: { canonical: "/blog", types: { "application/rss+xml": "/blog/rss.xml" } },
  };
}

export default async function BlogIndex({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const sf = await loadStorefront(site);
  const { t, store } = sf;
  const posts = await db.blogPost.findMany({ where: { storeId: store.id, published: true }, orderBy: { publishedAt: "desc" }, take: 60 });
  const date = new Intl.DateTimeFormat(sf.locale === "it" ? "it-IT" : "en-GB", { dateStyle: "long", timeZone: store.timezone });
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">{t("sf.blog.title")}</h1>
      {posts.length === 0 ? <p className="mt-6 text-muted">{t("sf.blog.empty")}</p> : (
        <ul className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <li key={p.id}>
              <Link href={sf.href(`/blog/${p.handle}`)} className="group block">
                <div className="aspect-[16/10] overflow-hidden rounded-xl bg-surface-2">
                  {p.coverUrl && <img src={p.coverUrl} alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" loading="lazy" />}
                </div>
                <p className="mt-3 text-xs text-muted">{p.publishedAt ? date.format(p.publishedAt) : ""}</p>
                <h2 className="mt-1 text-lg font-semibold leading-snug group-hover:underline">{p.title}</h2>
                {p.excerpt && <p className="mt-1 line-clamp-3 text-sm text-muted">{p.excerpt}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
