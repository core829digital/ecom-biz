import Link from "next/link";
import { cn } from "@/lib/cn";
import type { Translator } from "@/lib/i18n";

/** Sub-navigation of the Marketing area. */
export function MarketingTabs({ slug, active, t }: { slug: string; active: "subscribers" | "campaigns" | "automations"; t: Translator }) {
  const tabs = [
    { key: "subscribers", href: `/admin/${slug}/marketing` },
    { key: "campaigns", href: `/admin/${slug}/marketing/campaigns` },
    { key: "automations", href: `/admin/${slug}/marketing/automations` },
  ] as const;
  return (
    <nav className="mb-6 flex gap-1 border-b border-border" aria-label={t("nav.marketing")}>
      {tabs.map((tab) => (
        <Link key={tab.key} href={tab.href} aria-current={active === tab.key ? "page" : undefined}
          className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors", active === tab.key ? "border-text text-text" : "border-transparent text-muted hover:text-text")}>
          {t(`marketing.tab.${tab.key}`)}
        </Link>
      ))}
    </nav>
  );
}
