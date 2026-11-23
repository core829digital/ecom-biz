import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { permanentRedirect } from "next/navigation";
import "../../../globals.css";
// Storefront fonts are self-hosted: no visitor IPs are sent to third-party font CDNs (GDPR).
import "@fontsource-variable/inter";
import "@fontsource-variable/manrope";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/playfair-display";
import "@fontsource-variable/lora";
import "@fontsource-variable/space-grotesk";
import { db } from "@/lib/db";
import { loadStorefront, sfHref } from "@/server/storefront";
import { getCart, cartItemCount } from "@/server/cart";
import { themeCssVars } from "@/lib/theme";

type MenuItem = { title: string; url: string };
const menuItems = (json: unknown): MenuItem[] =>
  Array.isArray(json) ? json.filter((i): i is MenuItem => typeof i?.title === "string" && typeof i?.url === "string").slice(0, 30) : [];

export async function generateMetadata({ params }: { params: Promise<{ site: string }> }): Promise<Metadata> {
  const { store, theme, publicUrl } = await loadStorefront((await params).site);
  return {
    metadataBase: new URL(publicUrl),
    title: { default: store.seoTitle || store.name, template: `%s · ${store.name}` },
    description: store.seoDescription ?? undefined,
    icons: theme.faviconUrl ? [{ url: theme.faviconUrl }] : undefined,
    openGraph: { siteName: store.name, type: "website" },
  };
}

export default async function StorefrontLayout({ children, params }: { children: React.ReactNode; params: Promise<{ site: string }> }) {
  const { site } = await params;
  const sf = await loadStorefront(site);
  const { store, theme, t, base } = sf;
  // Visitors on the platform subdomain are sent to the primary custom domain (one canonical host for SEO).
  const h = await headers();
  if (!decodeURIComponent(site).includes(".") && h.has("x-store-base") && sf.publicUrl.startsWith("https://") && !sf.publicUrl.endsWith(`.${process.env.STOREFRONT_ROOT_DOMAIN}`)) {
    permanentRedirect(`${sf.publicUrl}${h.get("x-original-path") ?? "/"}`);
  }
  const [menus, cart] = await Promise.all([
    db.menu.findMany({ where: { storeId: store.id, handle: { in: ["main", "footer"] } } }),
    getCart(store.id),
  ]);
  const main = menuItems(menus.find((m) => m.handle === "main")?.items);
  const footer = menuItems(menus.find((m) => m.handle === "footer")?.items);
  const count = cartItemCount(cart);
  const social = Object.entries(theme.social).filter(([, url]) => /^https:\/\//.test(url));

  return (
    <html lang={store.locale}>
      <body className="storefront min-h-dvh" style={themeCssVars(theme) as React.CSSProperties}>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
          {t("sf.skip")}
        </a>
        {theme.announcement && sf.operational && (
          <div className="bg-brand px-4 py-2 text-center text-sm text-brand-contrast">{theme.announcement}</div>
        )}
        <header className="sticky top-0 z-30 border-b border-border bg-bg/95 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
            <details className="relative md:hidden">
              <summary className="list-none rounded p-2 text-lg leading-none" aria-label={t("sf.menu")}>☰</summary>
              <nav className="absolute left-0 top-full z-40 mt-2 w-64 rounded-lg border border-border bg-bg p-2 shadow-lg">
                {main.map((i) => (
                  <a key={i.title + i.url} href={sfHref(base, i.url)} className="block rounded px-3 py-2 hover:bg-surface-2">{i.title}</a>
                ))}
              </nav>
            </details>
            <Link href={sf.href("/")} className="flex min-w-0 items-center font-semibold tracking-tight">
              {theme.logoUrl ? <img src={theme.logoUrl} alt={store.name} style={{ height: theme.logoHeight }} className="w-auto max-w-[45vw] object-contain" /> : <span className="truncate text-lg">{store.name}</span>}
            </Link>
            <nav className="hidden flex-1 items-center gap-6 text-sm md:flex" aria-label={t("sf.menu")}>
              {main.map((i) => (
                <a key={i.title + i.url} href={sfHref(base, i.url)} className="text-text/80 hover:text-text">{i.title}</a>
              ))}
            </nav>
            <div className="ml-auto flex shrink-0 items-center gap-1 text-sm">
              <Link href={sf.href("/search")} className="rounded p-2 hover:bg-surface-2" aria-label={t("sf.search")} title={t("sf.search")}>
                <Icon d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z" />
              </Link>
              <Link href={sf.href("/account")} className="rounded p-2 hover:bg-surface-2" aria-label={t("sf.account")} title={t("sf.account")}>
                <Icon d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm-8 9a8 8 0 0 1 16 0" />
              </Link>
              <Link href={sf.href("/cart")} className="relative rounded p-2 hover:bg-surface-2" aria-label={`${t("sf.cart")} (${count})`} title={t("sf.cart")} data-testid="cart-link">
                <Icon d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.7a1 1 0 0 0 1-.8L21 8H6.2M9 20.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zm9 0a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z" />
                {count > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-semibold text-brand-contrast tabular-nums">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </header>
        <main id="main" className="min-h-[60vh]">
          {sf.operational ? (
            children
          ) : (
            <div className="mx-auto max-w-md px-4 py-24 text-center">
              <h1 className="text-2xl font-semibold">{store.name}</h1>
              <p className="mt-3 text-muted">{t("sf.unavailable")}</p>
            </div>
          )}
        </main>
        <footer className="mt-16 border-t border-border">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm sm:grid-cols-3 sm:px-6">
            <div>
              <p className="font-semibold">{store.name}</p>
              {theme.footerText && <p className="mt-2 whitespace-pre-line text-muted">{theme.footerText}</p>}
            </div>
            {footer.length > 0 && (
              <ul className="space-y-2">
                {footer.map((i) => (
                  <li key={i.title + i.url}><a href={sfHref(base, i.url)} className="text-muted hover:text-text">{i.title}</a></li>
                ))}
              </ul>
            )}
            {social.length > 0 && (
              <ul className="flex gap-4 sm:justify-end">
                {social.map(([name, url]) => (
                  <li key={name}><a href={url} target="_blank" rel="noopener noreferrer" className="capitalize text-muted hover:text-text">{name}</a></li>
                ))}
              </ul>
            )}
          </div>
          <p className="border-t border-border px-4 py-4 text-center text-xs text-muted">
            © {new Date().getFullYear()} {store.legalName || store.name}
          </p>
        </footer>
      </body>
    </html>
  );
}

function Icon({ d }: { d: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
