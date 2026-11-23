import { db } from "@/lib/db";
import { loadStorefront } from "@/server/storefront";
import { productCardInclude } from "@/server/catalog";
import { ProductGrid, StorePagination } from "@/components/storefront/product-card";

const PER_PAGE = 24;

export async function generateMetadata({ params }: { params: Promise<{ site: string }> }) {
  const { t } = await loadStorefront((await params).site);
  return { title: t("sf.search"), robots: { index: false } };
}

export default async function SearchPage({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<{ q?: string; page?: string }> }) {
  const sf = await loadStorefront((await params).site);
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const terms = q.split(/\s+/).filter(Boolean).slice(0, 5);
  const where = {
    storeId: sf.store.id,
    status: "ACTIVE" as const,
    AND: terms.map((term) => ({
      OR: [
        { title: { contains: term, mode: "insensitive" as const } },
        { description: { contains: term, mode: "insensitive" as const } },
        { vendor: { contains: term, mode: "insensitive" as const } },
        { productType: { contains: term, mode: "insensitive" as const } },
        { tags: { has: term.toLowerCase() } },
        { variants: { some: { sku: { equals: term, mode: "insensitive" as const } } } },
      ],
    })),
  };
  const [total, products] = q
    ? await Promise.all([
        db.product.count({ where }),
        db.product.findMany({ where, include: productCardInclude, orderBy: { title: "asc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
      ])
    : [0, []];
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">{sf.t("sf.search")}</h1>
      <form action={sf.href("/search")} role="search" className="mb-8 flex max-w-xl gap-2">
        <input type="search" name="q" defaultValue={q} autoFocus placeholder={sf.t("sf.searchPlaceholder")} aria-label={sf.t("sf.search")} className="h-12 min-w-0 flex-1 rounded-full border border-border bg-bg px-5" />
        <button className="h-12 shrink-0 rounded-full bg-brand px-5 font-medium text-brand-contrast">{sf.t("sf.search")}</button>
      </form>
      {q && <p className="mb-6 text-sm text-muted">{sf.t("sf.searchResults", { count: total, q })}</p>}
      {products.length > 0 && <ProductGrid products={products} sf={sf} />}
      <StorePagination sf={sf} path="/search" page={page} pages={Math.max(1, Math.ceil(total / PER_PAGE))} query={{ q }} />
    </div>
  );
}
