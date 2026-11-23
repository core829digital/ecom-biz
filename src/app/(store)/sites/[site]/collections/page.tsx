import Link from "next/link";
import { db } from "@/lib/db";
import { loadStorefront } from "@/server/storefront";

export async function generateMetadata({ params }: { params: Promise<{ site: string }> }) {
  const { t } = await loadStorefront((await params).site);
  return { title: t("sf.collections") };
}

export default async function CollectionsIndex({ params }: { params: Promise<{ site: string }> }) {
  const sf = await loadStorefront((await params).site);
  const collections = await db.collection.findMany({ where: { storeId: sf.store.id, published: true }, orderBy: { title: "asc" } });
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="mb-8 text-3xl font-semibold tracking-tight">{sf.t("sf.collections")}</h1>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <li>
          <Link href={sf.href("/collections/all")} className="flex aspect-[4/3] items-end rounded-lg bg-surface-2 p-4 font-medium hover:underline">{sf.t("sf.allProducts")} →</Link>
        </li>
        {collections.map((c) => (
          <li key={c.id}>
            <Link href={sf.href(`/collections/${c.handle}`)} className="group relative flex aspect-[4/3] items-end overflow-hidden rounded-lg bg-surface-2 p-4">
              {c.imageUrl && <img src={c.imageUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />}
              <span className={`relative rounded-full px-3 py-1 font-medium group-hover:underline ${c.imageUrl ? "bg-bg" : ""}`}>{c.title} →</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
