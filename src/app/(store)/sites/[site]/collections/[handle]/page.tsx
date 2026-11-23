import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { loadStorefront } from "@/server/storefront";
import { collectionProducts } from "@/server/catalog";
import { COLLECTION_SORTS, type CollectionSort } from "@/lib/collections";
import { RichText, plainExcerpt } from "@/lib/richtext";
import { ProductGrid, StorePagination } from "@/components/storefront/product-card";
import { SortSelect } from "@/components/storefront/sort-select";

type Props = { params: Promise<{ site: string; handle: string }>; searchParams: Promise<{ page?: string; sort?: string }> };

async function load(site: string, handle: string) {
  const sf = await loadStorefront(site);
  if (handle === "all") {
    return {
      sf,
      collection: { id: "all", storeId: sf.store.id, type: "SMART" as const, rules: [], matchAll: true, sortOrder: "newest", title: sf.t("sf.allProducts"), description: "", imageUrl: null, seoTitle: null, seoDescription: null, handle: "all" },
    };
  }
  const collection = await db.collection.findFirst({ where: { storeId: sf.store.id, handle, published: true } });
  if (!collection) notFound();
  return { sf, collection };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { site, handle } = await params;
  const { collection } = await load(site, handle);
  return {
    title: collection.seoTitle || collection.title,
    description: collection.seoDescription || plainExcerpt(collection.description) || undefined,
    alternates: { canonical: `/collections/${collection.handle}` },
    openGraph: collection.imageUrl ? { images: [collection.imageUrl] } : undefined,
  };
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const { site, handle } = await params;
  const sp = await searchParams;
  const { sf, collection } = await load(site, handle);
  const sort = COLLECTION_SORTS.includes(sp.sort as CollectionSort) ? (sp.sort as CollectionSort) : undefined;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const { products, total, perPage } = await collectionProducts(collection, { page, sort });
  const pages = Math.max(1, Math.ceil(total / perPage));
  const currentSort = sort ?? (collection.sortOrder as CollectionSort);
  const sortOptions = COLLECTION_SORTS.filter((s) => s !== "manual" || (collection.id !== "all" && collection.type === "MANUAL"));

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">{collection.title}</h1>
        {collection.description && <RichText text={collection.description} className="prose-store mt-3 max-w-2xl text-muted" />}
      </header>
      <div className="mb-6 flex items-center justify-between gap-4 text-sm">
        <span className="text-muted">{sf.t("sf.productCount", { count: total })}</span>
        <SortSelect
          value={currentSort}
          label={sf.t("sf.sortBy")}
          options={sortOptions.map((s) => ({ value: s, label: sf.t(`collections.sort.${s}`) }))}
        />
      </div>
      {products.length ? <ProductGrid products={products} sf={sf} /> : <p className="py-16 text-center text-muted">{sf.t("sf.noProducts")}</p>}
      <StorePagination sf={sf} path={`/collections/${collection.handle}`} page={page} pages={pages} query={sort ? { sort } : undefined} />
    </div>
  );
}
