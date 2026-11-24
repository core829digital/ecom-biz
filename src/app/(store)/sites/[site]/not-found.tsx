import Link from "next/link";
import { headers } from "next/headers";
import { resolveStore } from "@/lib/tenant";
import { getTranslator } from "@/lib/i18n";

/**
 * 404 inside a store, in the store's language. not-found pages receive no params,
 * so the store is resolved from the host the same way the middleware does.
 */
export default async function StoreNotFound() {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").toLowerCase();
  const root = (process.env.STOREFRONT_ROOT_DOMAIN || "localhost:3000").toLowerCase();
  const key = host.endsWith(`.${root}`) ? host.slice(0, -(root.length + 1)) : host;
  const store = key ? await resolveStore(key).catch(() => null) : null;
  const t = getTranslator(store?.locale);
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="text-6xl font-semibold tracking-tight text-muted">404</p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">{t("sf.notFound.title")}</h1>
      <p className="mt-2 text-muted">{t("sf.notFound.body")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="inline-flex h-11 items-center rounded-btn bg-brand px-6 font-medium text-brand-contrast">{t("sf.notFound.home")}</Link>
        <Link href="/search" className="inline-flex h-11 items-center rounded-btn border border-border px-6 font-medium hover:bg-surface-2">{t("sf.search")}</Link>
      </div>
    </div>
  );
}
