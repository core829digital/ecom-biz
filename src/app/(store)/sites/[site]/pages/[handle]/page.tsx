import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";
import { db } from "@/lib/db";
import { loadStorefront } from "@/server/storefront";
import { RichText, plainExcerpt } from "@/lib/richtext";

type Props = { params: Promise<{ site: string; handle: string }> };
const loadPage = cache((storeId: string, handle: string) => db.page.findFirst({ where: { storeId, handle, published: true } }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { site, handle } = await params;
  const sf = await loadStorefront(site);
  const page = await loadPage(sf.store.id, handle);
  if (!page) return {};
  return { title: page.seoTitle || page.title, description: page.seoDescription || plainExcerpt(page.body), alternates: { canonical: `/pages/${page.handle}` } };
}

export default async function ContentPage({ params }: Props) {
  const { site, handle } = await params;
  const sf = await loadStorefront(site);
  const page = await loadPage(sf.store.id, handle);
  if (!page) notFound();
  return (
    <article className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="mb-8 text-3xl font-semibold tracking-tight">{page.title}</h1>
      <RichText text={page.body} className="prose-store" />
    </article>
  );
}
