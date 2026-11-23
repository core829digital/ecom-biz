import Link from "next/link";
import { db } from "@/lib/db";
import { loadStorefront, sfHref } from "@/server/storefront";
import { collectionProducts, productCardInclude } from "@/server/catalog";
import { ProductGrid } from "@/components/storefront/product-card";

export default async function StoreHome({ params }: { params: Promise<{ site: string }> }) {
  const sf = await loadStorefront((await params).site);
  const { store, theme, t } = sf;
  const featured = theme.featuredCollectionId
    ? await db.collection.findFirst({ where: { id: theme.featuredCollectionId, storeId: store.id, published: true } })
    : null;
  const products = featured
    ? (await collectionProducts(featured, { perPage: 8 })).products
    : await db.product.findMany({ where: { storeId: store.id, status: "ACTIVE" }, include: productCardInclude, orderBy: { createdAt: "desc" }, take: 8 });
  const collections = await db.collection.findMany({ where: { storeId: store.id, published: true }, orderBy: { title: "asc" }, take: 6 });

  return (
    <>
      <section className="relative overflow-hidden bg-surface-2">
        {theme.heroImageUrl && <img src={theme.heroImageUrl} alt="" className="absolute inset-0 size-full object-cover" />}
        {theme.heroImageUrl && <div className="absolute inset-0 bg-black/35" aria-hidden />}
        <div className={`relative mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32 ${theme.heroImageUrl ? "text-white" : ""}`}>
          <h1 className="max-w-2xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">{theme.heroTitle || store.name}</h1>
          {theme.heroSubtitle && <p className="mt-4 max-w-xl text-pretty text-lg opacity-90">{theme.heroSubtitle}</p>}
          <a href={sfHref(sf.base, theme.heroCtaUrl || "/collections/all")} className="mt-8 inline-flex h-12 items-center rounded-full bg-brand px-7 font-medium text-brand-contrast hover:opacity-90">
            {theme.heroCtaLabel || t("sf.shopNow")}
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-8 flex items-end justify-between">
          <h2 className="text-2xl font-semibold tracking-tight">{theme.featuredTitle || featured?.title || t("sf.featured")}</h2>
          <Link href={sf.href(featured ? `/collections/${featured.handle}` : "/collections/all")} className="text-sm underline">{t("sf.viewAll")}</Link>
        </div>
        {products.length ? <ProductGrid products={products} sf={sf} /> : <p className="text-muted">{t("sf.noProducts")}</p>}
      </section>

      {collections.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
          <h2 className="mb-8 text-2xl font-semibold tracking-tight">{t("sf.collections")}</h2>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {collections.map((c) => (
              <li key={c.id}>
                <Link href={sf.href(`/collections/${c.handle}`)} className="group relative block aspect-[4/3] overflow-hidden rounded-lg bg-surface-2">
                  {c.imageUrl && <img src={c.imageUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105" />}
                  <span className={`absolute bottom-3 left-3 rounded-full px-3 py-1 text-sm font-medium ${c.imageUrl ? "bg-bg" : ""}`}>{c.title} →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
