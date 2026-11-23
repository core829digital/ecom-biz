import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";
import { db } from "@/lib/db";
import { loadStorefront } from "@/server/storefront";
import { maxPurchasable } from "@/server/cart";
import { RichText, plainExcerpt } from "@/lib/richtext";
import { productCardInclude } from "@/server/catalog";
import { Gallery } from "@/components/storefront/gallery";
import { VariantPicker } from "@/components/storefront/variant-picker";
import { ProductGrid } from "@/components/storefront/product-card";
import { addToCartAction } from "../../cart/actions";

type Props = { params: Promise<{ site: string; handle: string }>; searchParams: Promise<{ variant?: string }> };

const loadProduct = cache(async (storeId: string, handle: string) =>
  db.product.findFirst({
    where: { storeId, handle, status: "ACTIVE" },
    include: { options: { orderBy: { position: "asc" } }, images: { orderBy: { position: "asc" } }, variants: { orderBy: { position: "asc" } } },
  }),
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { site, handle } = await params;
  const sf = await loadStorefront(site);
  const product = await loadProduct(sf.store.id, handle);
  if (!product) return {};
  const description = product.seoDescription || plainExcerpt(product.description) || undefined;
  return {
    title: product.seoTitle || product.title,
    description,
    alternates: { canonical: `/products/${product.handle}` },
    openGraph: { title: product.title, description, images: product.images.slice(0, 1).map((i) => i.url) },
  };
}

export default async function ProductPage({ params, searchParams }: Props) {
  const { site, handle } = await params;
  const { variant: variantParam } = await searchParams;
  const sf = await loadStorefront(site);
  const { store, t } = sf;
  const product = await loadProduct(store.id, handle);
  if (!product) notFound();

  const variants = product.variants.map((v) => ({
    id: v.id,
    values: product.options.map((_, i) => [v.option1, v.option2, v.option3][i] ?? null),
    price: sf.money(v.priceCents),
    compareAt: v.compareAtCents && v.compareAtCents > v.priceCents ? sf.money(v.compareAtCents) : null,
    available: maxPurchasable(v),
  }));
  const related = await db.product.findMany({
    where: {
      storeId: store.id,
      status: "ACTIVE",
      id: { not: product.id },
      OR: [{ productType: product.productType ?? "__" }, { tags: { hasSome: product.tags.length ? product.tags : ["__"] } }],
    },
    include: productCardInclude,
    take: 4,
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: plainExcerpt(product.description, 500),
    image: product.images.map((i) => i.url.startsWith("/") ? `${sf.publicUrl}${i.url}` : i.url),
    sku: product.variants[0]?.sku ?? undefined,
    brand: product.vendor ? { "@type": "Brand", name: product.vendor } : undefined,
    offers: product.variants.map((v) => ({
      "@type": "Offer",
      price: (v.priceCents / 100).toFixed(2),
      priceCurrency: store.currency,
      availability: maxPurchasable(v) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${sf.publicUrl}/products/${product.handle}?variant=${v.id}`,
    })),
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="grid gap-10 md:grid-cols-2">
        <Gallery images={product.images} title={product.title} />
        <div>
          {product.vendor && <p className="mb-2 text-sm uppercase tracking-wider text-muted">{product.vendor}</p>}
          <h1 className="mb-4 text-3xl font-semibold tracking-tight">{product.title}</h1>
          <VariantPicker
            options={product.options.map((o) => ({ name: o.name, values: o.values }))}
            variants={variants}
            initialVariantId={variantParam}
            addToCart={addToCartAction.bind(null, site)}
            cartHref={sf.href("/cart")}
            labels={{
              add: t("sf.addToCart"),
              soldOut: t("sf.soldOut"),
              unavailable: t("sf.unavailableVariant"),
              quantity: t("sf.quantity"),
              added: t("sf.added"),
              viewCart: t("sf.viewCart"),
              lowStock: t("sf.lowStock"),
            }}
          />
          <p className="mt-3 text-xs text-muted">{store.taxesIncluded ? t("sf.taxIncluded") : t("sf.taxExcluded")}</p>
          {product.description && <RichText text={product.description} className="prose-store mt-8 border-t border-border pt-8" />}
        </div>
      </div>
      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="mb-6 text-xl font-semibold">{t("sf.related")}</h2>
          <ProductGrid products={related} sf={sf} />
        </section>
      )}
    </div>
  );
}
