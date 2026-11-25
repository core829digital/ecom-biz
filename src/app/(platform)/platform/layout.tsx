import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { env } from "@/lib/env";
import { Suspense } from "react";
import { I18nProvider } from "@/components/i18n-provider";
import { PageTransition } from "@/components/page-transition";
import { NavProgress } from "@/components/storefront/nav-progress";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin();
  const { t, locale } = await getPlatformT();
  const nav = [
    ["/platform", t("platform.overview")],
    ["/platform/stores", t("platform.stores")],
    ["/platform/plans", t("platform.plans")],
    ["/platform/users", t("platform.users")],
  ];
  return (
    <div className="min-h-dvh">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <span className="text-sm font-semibold">{env.platformName} · {t("platform.title")}</span>
          <nav className="flex flex-wrap gap-4 text-sm">
            {nav.map(([href, label]) => <Link key={href} href={href} className="text-muted hover:text-text">{label}</Link>)}
          </nav>
          <Link href="/admin" className="ml-auto text-sm text-muted hover:text-text">{t("nav.allStores")} →</Link>
        </div>
      </header>
      <Suspense fallback={null}><NavProgress barClassName="bg-accent" /></Suspense>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6"><I18nProvider locale={locale}><PageTransition>{children}</PageTransition></I18nProvider></main>
    </div>
  );
}
