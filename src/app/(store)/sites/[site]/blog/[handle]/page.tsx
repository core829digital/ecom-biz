import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { loadStorefront } from "@/server/storefront";
import { RichText, plainExcerpt } from "@/lib/richtext";

const loadPost = cache((storeId: string, handle: string) => db.blogPost.findFirst({ where: { storeId, handle, published: true } }));

export async function generateMetadata({ params }: { params: Promise<{ site: string; handle: string }> }): Promise<Metadata> {
  const { site, handle } = await params;
  const sf = await loadStorefront(site);
  const post = await loadPost(sf.store.id, handle);
  if (!post) return {};
  const description = post.seoDescription || post.excerpt || plainExcerpt(post.body);
  return {
    title: post.seoTitle || post.title,
    description,
    alternates: { canonical: `/blog/${post.handle}` },
    openGraph: { type: "article", title: post.title, description, publishedTime: post.publishedAt?.toISOString(), images: post.coverUrl ? [post.coverUrl] : undefined },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ site: string; handle: string }> }) {
  const { site, handle } = await params;
  const sf = await loadStorefront(site);
  const { t, store } = sf;
  const post = await loadPost(store.id, handle);
  if (!post) notFound();
  const date = new Intl.DateTimeFormat(sf.locale === "it" ? "it-IT" : "en-GB", { dateStyle: "long", timeZone: store.timezone });
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: { "@type": post.authorName ? "Person" : "Organization", name: post.authorName || store.name },
    publisher: { "@type": "Organization", name: store.name },
    image: post.coverUrl ?? undefined,
    mainEntityOfPage: `${sf.publicUrl}/blog/${post.handle}`,
  };
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Link href={sf.href("/blog")} className="text-sm text-muted hover:text-text">← {t("sf.blog.title")}</Link>
      <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight">{post.title}</h1>
      <p className="mt-3 text-sm text-muted">{[post.authorName, post.publishedAt ? date.format(post.publishedAt) : null].filter(Boolean).join(" · ")}</p>
      {post.coverUrl && <img src={post.coverUrl} alt="" className="mt-8 w-full rounded-xl object-cover" />}
      <RichText text={post.body} className="legal-prose mt-8" />
    </article>
  );
}
