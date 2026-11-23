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
import { submitReviewAction, subscribeStockAlertAction } from "./actions";
import { Stars } from "@/components/storefront/stars";
import { ReviewForm } from "@/components/storefront/reviews";
import { getCurrentCustomer } from "@/lib/auth/customer";

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
  const [reviewStats, reviews] = await Promise.all([
    db.productReview.groupBy({ by: ["rating"], where: { productId: product.id, status: "APPROVED" }, _count: true }),
    db.productReview.findMany({ where: { productId: product.id, status: "APPROVED" }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const reviewCount = reviewStats.reduce((n, r) => n + r._count, 0);
  const avgRating = reviewCount ? reviewStats.reduce((s, r) => s + r.rating * r._count, 0) / reviewCount : 0;
  const customer = store.reviewsEnabled ? await getCurrentCustomer(store.id) : null;
  const reviewDate = new Intl.DateTimeFormat(sf.locale === "it" ? "it-IT" : "en-GB", { dateStyle: "medium", timeZone: sf.store.timezone });
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
    aggregateRating: reviewCount ? { "@type": "AggregateRating", ratingValue: avgRating.toFixed(2), reviewCount } : undefined,
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
          <h1 className="mb-2 text-3xl font-semibold tracking-tight">{product.title}</h1>
          {reviewCount > 0 && (
            <a href="#reviews" className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:text-text">
              <Stars value={avgRating} /> {avgRating.toFixed(1)} · {t("sf.reviews.count", { count: reviewCount })}
            </a>
          )}
          <div className="mb-4" />
          <VariantPicker
            options={product.options.map((o) => ({ name: o.name, values: o.values }))}
            variants={variants}
            initialVariantId={variantParam}
            addToCart={addToCartAction.bind(null, site)}
            notifyMe={subscribeStockAlertAction.bind(null, site)}
            cartHref={sf.href("/cart")}
            labels={{
              add: t("sf.addToCart"),
              soldOut: t("sf.soldOut"),
              unavailable: t("sf.unavailableVariant"),
              quantity: t("sf.quantity"),
              added: t("sf.added"),
              viewCart: t("sf.viewCart"),
              lowStock: t("sf.lowStock"),
              notifyTitle: t("sf.notify.title"),
              notifyCta: t("sf.notify.cta"),
              email: t("field.email"),
            }}
          />
          <p className="mt-3 text-xs text-muted">{store.taxesIncluded ? t("sf.taxIncluded") : t("sf.taxExcluded")}</p>
          {product.description && <RichText text={product.description} className="prose-store mt-8 border-t border-border pt-8" />}
        </div>
      </div>
      {store.reviewsEnabled && (
        <section id="reviews" className="mt-20 scroll-mt-24 border-t border-border pt-12">
          <div className="grid gap-10 md:grid-cols-[280px_1fr]">
            <div>
              <h2 className="text-xl font-semibold">{t("sf.reviews.title")}</h2>
              {reviewCount > 0 ? (
                <>
                  <p className="mt-3 flex items-center gap-2"><span className="text-4xl font-semibold tabular-nums">{avgRating.toFixed(1)}</span><Stars value={avgRating} size={18} /></p>
                  <p className="text-sm text-muted">{t("sf.reviews.count", { count: reviewCount })}</p>
                  <ul className="mt-4 space-y-1.5">
                    {[5, 4, 3, 2, 1].map((n) => {
                      const c = reviewStats.find((r) => r.rating === n)?._count ?? 0;
                      return (
                        <li key={n} className="flex items-center gap-2 text-xs text-muted">
                          <span className="w-3 tabular-nums">{n}</span>
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2"><span className="block h-full rounded-full bg-amber-400" style={{ width: `${(c / reviewCount) * 100}%` }} /></span>
                          <span className="w-6 text-right tabular-nums">{c}</span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : <p className="mt-3 text-sm text-muted">{t("sf.reviews.none")}</p>}
              <div className="mt-6">
                <ReviewForm
                  action={submitReviewAction.bind(null, site, product.id)}
                  defaults={customer ? { name: [customer.firstName, customer.lastName].filter(Boolean).join(" "), email: customer.email } : undefined}
                  labels={{
                    write: t("sf.reviews.write"), name: t("sf.reviews.name"), email: t("field.email"), title: t("sf.reviews.titleField"),
                    body: t("sf.reviews.body"), submit: t("sf.reviews.submit"), rating: t("sf.reviews.rating"), emailHint: customer ? t("sf.reviews.emailHint") : t("sf.reviews.emailHintGuest"),
                  }}
                />
              </div>
            </div>
            <ul className="space-y-8">
              {reviews.map((r) => (
                <li key={r.id} className="border-b border-border pb-8 last:border-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Stars value={r.rating} />
                    {r.title && <p className="font-semibold">{r.title}</p>}
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{r.body}</p>
                  <p className="mt-3 text-xs text-muted">
                    {r.name} · {reviewDate.format(r.createdAt)}
                    {r.verifiedPurchase && <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 font-medium text-text">✓ {t("sf.reviews.verified")}</span>}
                  </p>
                  {r.reply && (
                    <div className="mt-3 rounded-lg bg-surface-2 p-3 text-sm">
                      <p className="mb-1 text-xs font-semibold">{t("sf.reviews.replyFrom", { store: store.name })}</p>
                      <p className="whitespace-pre-line">{r.reply}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="mb-6 text-xl font-semibold">{t("sf.related")}</h2>
          <ProductGrid products={related} sf={sf} />
        </section>
      )}
    </div>
  );
}
