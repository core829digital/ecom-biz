import Link from "next/link";
import type { ProductCardData } from "@/server/catalog";
import type { Storefront } from "@/server/storefront";

export function ProductCard({ product, sf }: { product: ProductCardData; sf: Storefront }) {
  const prices = product.variants.map((v) => v.priceCents);
  const min = Math.min(...prices);
  const varies = Math.max(...prices) !== min;
  const cheapest = product.variants.find((v) => v.priceCents === min);
  const onSale = cheapest?.compareAtCents && cheapest.compareAtCents > min;
  const soldOut = product.variants.every((v) => v.trackInventory && !v.allowBackorder && v.inventoryQty <= 0);
  const [img, hover] = product.images;
  return (
    <Link href={sf.href(`/products/${product.handle}`)} className="group block">
      <div className="relative mb-3 aspect-[4/5] overflow-hidden rounded-card bg-surface-2">
        {img && <img src={img.url} alt={img.alt ?? product.title} loading="lazy" className="absolute inset-0 size-full object-cover transition-opacity duration-300 group-hover:opacity-90" />}
        {hover && <img src={hover.url} alt="" loading="lazy" className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100" />}
        {(soldOut || onSale) && (
          <span className="absolute left-2 top-2 rounded-full bg-bg px-2.5 py-1 text-xs font-medium">
            {soldOut ? sf.t("sf.soldOut") : sf.t("sf.sale")}
          </span>
        )}
      </div>
      <h3 className="text-sm font-medium group-hover:underline">{product.title}</h3>
      <p className="mt-1 text-sm tabular-nums">
        {varies && <span className="text-muted">{sf.t("sf.from")} </span>}
        <span className={onSale ? "text-sf-accent font-medium" : ""}>{sf.money(min)}</span>
        {onSale && <s className="ml-2 text-muted">{sf.money(cheapest!.compareAtCents!)}</s>}
      </p>
    </Link>
  );
}

export function ProductGrid({ products, sf, stagger }: { products: ProductCardData[]; sf: Storefront; stagger?: boolean }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p, i) => (
        <li key={p.id} {...(stagger ? { "data-reveal-item": "", style: { "--i": Math.min(i, 8) } as React.CSSProperties } : {})}><ProductCard product={p} sf={sf} /></li>
      ))}
    </ul>
  );
}

export function StorePagination({ sf, path, page, pages, query }: { sf: Storefront; path: string; page: number; pages: number; query?: Record<string, string> }) {
  if (pages <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams({ ...(query ?? {}), page: String(p) });
    return `${sf.href(path)}?${sp}`;
  };
  return (
    <nav className="mt-12 flex items-center justify-center gap-6 text-sm" aria-label="Pagination">
      {page > 1 ? <Link href={href(page - 1)} className="underline">← {sf.t("common.previous")}</Link> : <span />}
      <span className="text-muted">{sf.t("common.page", { page, pages })}</span>
      {page < pages ? <Link href={href(page + 1)} className="underline">{sf.t("common.next")} →</Link> : <span />}
    </nav>
  );
}
