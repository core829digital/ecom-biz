"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  BarChart3, Boxes, ChevronDown, Code2, Copy, CreditCard, ExternalLink, FileText, Globe, Home, LayoutGrid, LogOut, Menu, Navigation,
  FolderOpen, Package, Palette, Percent, Plus, Receipt, Search, Settings, Shield, ShoppingBag, Sparkles, Star, Inbox, Megaphone, Store, Truck, UserPlus, Users, X, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { ThemePref } from "@/lib/appearance";
import { ThemeSwitcher } from "@/components/appearance/theme-switcher";
import { toast } from "@/components/ui/toast";
import { PageTransition } from "@/components/page-transition";
import { NavProgress } from "@/components/storefront/nav-progress";

export const NAV_ICONS = {
  home: Home, orders: ShoppingBag, products: Package, inventory: Boxes, collections: LayoutGrid, customers: Users, discounts: Percent,
  onlineStore: Store, theme: Palette, pages: FileText, navigation: Navigation, domains: Globe, settings: Settings, general: Settings,
  payments: CreditCard, shipping: Truck, taxes: Receipt, checkout: ShoppingBag, staff: Users, billing: BarChart3, developers: Code2,
  audit: Shield, reviews: Star, inbox: Inbox, marketing: Megaphone, assistant: Sparkles, files: FolderOpen,
} satisfies Record<string, LucideIcon>;
export type NavIcon = keyof typeof NAV_ICONS;

export type NavItem = { href: string; label: string; icon: NavIcon; exact?: boolean; badge?: number; children?: { href: string; label: string }[] };
export type RailStore = { slug: string; name: string; badge: number };

export type ShellLabels = {
  viewStore: string; menu: string; allStores: string; logout: string; newStore: string; search: string; account: string;
  platform: string; storeSettings: string; inviteStaff: string; copyUrl: string; copied: string; limitReached: string;
  theme: Record<ThemePref, string>;
};

const spring = { type: "spring" as const, stiffness: 500, damping: 38 };

/**
 * Admin chrome inspired by Discord: a store rail (like servers), a store-scoped
 * sidebar with a header menu, a user panel at the bottom, and a top bar with
 * the quick switcher (Ctrl/⌘ K).
 */
export function AdminShell({
  platformName, storeName, storeUrl, nav, stores, currentSlug, canCreateStore, user, labels, logoutAction, banner, usage, theme, topbar, children,
}: {
  platformName: string;
  storeName: string;
  storeUrl: string;
  nav: NavItem[];
  stores: RailStore[];
  currentSlug: string;
  canCreateStore: boolean;
  user: { name: string; email: string; isPlatformAdmin: boolean };
  labels: ShellLabels;
  logoutAction: () => Promise<void>;
  banner?: ReactNode;
  usage?: ReactNode;
  theme: ThemePref;
  /** Extra controls on the right of the top bar (e.g. notifications). */
  topbar?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [themePref, setThemePref] = useState<ThemePref>(theme);
  const reduce = useReducedMotion();
  useEffect(() => setOpen(false), [pathname]);

  const isActive = (item: { href: string; exact?: boolean }) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");

  const rail = <StoreRail stores={stores} currentSlug={currentSlug} canCreate={canCreateStore} labels={labels} platformName={platformName} isPlatformAdmin={user.isPlatformAdmin} />;

  const sidebar = (
    <div className="flex h-full min-w-0 flex-col">
      <StoreHeader storeName={storeName} storeUrl={storeUrl} slug={currentSlug} labels={labels} />
      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Admin">
        <ul className="space-y-0.5">
          {nav.map((item) => {
            const active = isActive(item);
            const Icon = NAV_ICONS[item.icon];
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active && pathname === item.href ? "page" : undefined}
                  className={cn("group relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors", active ? "font-medium text-text" : "text-muted hover:bg-surface-2 hover:text-text")}
                >
                  {active && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-md bg-surface-3/70" transition={reduce ? { duration: 0 } : spring} />}
                  <Icon className="relative size-4 shrink-0" aria-hidden />
                  <span className="relative flex-1 truncate">{item.label}</span>
                  {!!item.badge && <span className="relative rounded-full bg-danger px-1.5 text-[11px] font-semibold leading-5 text-white tabular-nums">{item.badge > 99 ? "99+" : item.badge}</span>}
                </Link>
                <AnimatePresence initial={false}>
                  {item.children && active && (
                    <motion.ul
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: reduce ? 0 : 0.2, ease: [0.4, 0, 0.2, 1] }}
                      className="ml-[18px] overflow-hidden border-l border-border pl-3"
                    >
                      {item.children.map((c) => (
                        <li key={c.href}>
                          <Link href={c.href} aria-current={pathname.startsWith(c.href) ? "page" : undefined}
                            className={cn("block rounded-md px-2 py-1 text-[13px] transition-colors", pathname.startsWith(c.href) ? "font-medium text-text" : "text-muted hover:text-text")}>
                            {c.label}
                          </Link>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      </nav>
      {usage && <div className="px-2 pb-2">{usage}</div>}
      <UserPanel user={user} labels={labels} logoutAction={logoutAction} />
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[72px_248px_1fr]">
      <div className="sticky top-0 hidden h-dvh lg:block">{rail}</div>
      <aside className="sticky top-0 hidden h-dvh border-r border-border bg-sidebar lg:block">{sidebar}</aside>

      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} aria-hidden />
            <motion.div
              className="fixed inset-y-0 left-0 z-50 flex shadow-elevated lg:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 40 }}
              role="dialog"
              aria-label={labels.menu}
            >
              {rail}
              <aside className="relative w-[248px] border-r border-border bg-sidebar">
                <button onClick={() => setOpen(false)} className="absolute right-2 top-3 z-10 rounded-md p-1.5 text-muted hover:bg-surface-2" aria-label="Close"><X className="size-4" /></button>
                {sidebar}
              </aside>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-bg/80 px-4 backdrop-blur-md sm:px-6">
          <button onClick={() => setOpen(true)} className="-ml-1 rounded-md p-1.5 hover:bg-surface-2 lg:hidden" aria-label={labels.menu} aria-expanded={open}>
            <Menu className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
            className="flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-muted shadow-soft transition-colors hover:border-border-strong"
          >
            <Search className="size-4" aria-hidden />
            <span className="flex-1 truncate text-left">{labels.search}</span>
            <kbd className="hidden rounded border border-border bg-surface-2 px-1.5 py-0.5 font-sans text-[11px] sm:inline">Ctrl K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-2">
            {topbar}
            <div className="hidden sm:block">
              <ThemeSwitcher theme={themePref} onChange={setThemePref} labels={labels.theme} compact layoutId="topbar-theme" />
            </div>
          </div>
        </header>
        {banner}
        <Suspense fallback={null}><NavProgress barClassName="bg-accent" /></Suspense>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:py-8"><PageTransition>{children}</PageTransition></main>
      </div>
    </div>
  );
}

/** Discord-style vertical rail of stores. */
function StoreRail({ stores, currentSlug, canCreate, labels, platformName, isPlatformAdmin }: {
  stores: RailStore[]; currentSlug: string; canCreate: boolean; labels: ShellLabels; platformName: string; isPlatformAdmin: boolean;
}) {
  return (
    <nav aria-label={labels.allStores} className="flex h-full w-[72px] flex-col items-center gap-2 overflow-y-auto border-r border-border bg-surface-2 py-3">
      <RailItem href="/admin" label={labels.allStores} active={false}>
        <span className="text-sm font-bold">{platformName.slice(0, 1).toUpperCase()}</span>
      </RailItem>
      {isPlatformAdmin && (
        <RailItem href="/platform" label={labels.platform} active={false}>
          <Shield className="size-5" aria-hidden />
        </RailItem>
      )}
      <div className="h-px w-8 bg-border" aria-hidden />
      {stores.map((s) => (
        <RailItem key={s.slug} href={`/admin/${s.slug}`} label={s.name} active={s.slug === currentSlug} badge={s.badge}>
          <span className="text-sm font-semibold">{initials(s.name)}</span>
        </RailItem>
      ))}
      <RailItem href={canCreate ? "/admin/new" : "/account/billing"} label={canCreate ? labels.newStore : labels.limitReached} active={false} variant="add">
        <Plus className="size-5" aria-hidden />
      </RailItem>
    </nav>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}

function RailItem({ href, label, active, badge, variant, children }: { href: string; label: string; active: boolean; badge?: number; variant?: "add"; children: ReactNode }) {
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const reduce = useReducedMotion();
  const show = () => {
    const r = linkRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.top + r.height / 2, left: r.right + 12 });
    setHover(true);
  };
  return (
    <div className="relative flex w-full justify-center" onMouseEnter={show} onMouseLeave={() => setHover(false)}>
      {/* Left pill: tall when active, short on hover (as in Discord). */}
      <motion.span
        className="absolute left-0 top-1/2 w-1 -translate-y-1/2 rounded-r-full bg-text"
        initial={false}
        animate={{ height: active ? 36 : hover ? 18 : 0, opacity: active || hover ? 1 : 0 }}
        transition={reduce ? { duration: 0 } : spring}
        aria-hidden
      />
      <Link
        ref={linkRef}
        href={href}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        onFocus={show}
        onBlur={() => setHover(false)}
        className={cn(
          "relative flex size-12 items-center justify-center transition-all duration-200",
          active || hover ? "rounded-2xl" : "rounded-[24px]",
          variant === "add"
            ? hover ? "bg-success text-white" : "bg-surface text-success"
            : active ? "bg-accent text-accent-contrast" : hover ? "bg-accent text-accent-contrast" : "bg-surface text-text",
        )}
      >
        {children}
        {!!badge && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full border-[3px] border-surface-2 bg-danger px-1 text-[10px] font-bold text-white tabular-nums">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </Link>
      <AnimatePresence>
        {hover && pos && (
          <motion.span
            role="tooltip"
            initial={{ opacity: 0, x: -4, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -4, scale: 0.96 }}
            transition={{ duration: 0.12 }}
            className="pointer-events-none fixed z-[60] -translate-y-1/2 whitespace-nowrap rounded-md bg-text px-2.5 py-1.5 text-sm font-medium text-bg shadow-elevated"
            style={{ top: pos.top, left: pos.left }}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOut: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onOut(); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onOut(); };
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, [ref, onOut, active]);
}

const popover = {
  initial: { opacity: 0, y: -6, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } },
  transition: spring,
};

/** Store name header with a quick menu (like a Discord server header). */
function StoreHeader({ storeName, storeUrl, slug, labels }: { storeName: string; storeUrl: string; slug: string; labels: ShellLabels }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);
  const item = "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm hover:bg-accent hover:text-accent-contrast";
  return (
    <div ref={ref} className="relative border-b border-border">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" className="flex h-14 w-full items-center gap-2 px-4 text-left transition-colors hover:bg-surface-2">
        <span className="flex-1 truncate text-[15px] font-semibold">{storeName}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={spring}><ChevronDown className="size-4 text-muted" aria-hidden /></motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div {...popover} role="menu" className="absolute left-2 right-2 top-[52px] z-50 origin-top rounded-xl border border-border bg-surface p-1.5 shadow-elevated">
            <a role="menuitem" href={storeUrl} target="_blank" rel="noreferrer" className={item}><ExternalLink className="size-4" aria-hidden /> {labels.viewStore}</a>
            <button role="menuitem" className={item} onClick={async () => { await navigator.clipboard.writeText(storeUrl); toast(labels.copied); setOpen(false); }}>
              <Copy className="size-4" aria-hidden /> {labels.copyUrl}
            </button>
            <div className="my-1 border-t border-border" />
            <Link role="menuitem" href={`/admin/${slug}/settings/staff`} className={item}><UserPlus className="size-4" aria-hidden /> {labels.inviteStaff}</Link>
            <Link role="menuitem" href={`/admin/${slug}/settings`} className={item}><Settings className="size-4" aria-hidden /> {labels.storeSettings}</Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Bottom-left user panel with quick access to account settings (Discord-style). */
function UserPanel({ user, labels, logoutAction }: { user: { name: string; email: string; isPlatformAdmin: boolean }; labels: ShellLabels; logoutAction: () => Promise<void> }) {
  const initialsText = user.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="flex items-center gap-2 border-t border-border bg-surface-2/60 px-2 py-2">
      <Link href="/account" className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 hover:bg-surface-3/70">
        <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-contrast">
          {initialsText}
          <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-surface-2 bg-success" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium leading-tight">{user.name}</span>
          <span className="block truncate text-[11px] leading-tight text-muted">{user.email}</span>
        </span>
      </Link>
      <Link href="/account" className="rounded-md p-1.5 text-muted hover:bg-surface-3/70 hover:text-text" aria-label={labels.account} title={labels.account}>
        <Settings className="size-4" />
      </Link>
      <form action={logoutAction}>
        <button className="rounded-md p-1.5 text-muted hover:bg-surface-3/70 hover:text-danger" aria-label={labels.logout} title={labels.logout}>
          <LogOut className="size-4" />
        </button>
      </form>
    </div>
  );
}
