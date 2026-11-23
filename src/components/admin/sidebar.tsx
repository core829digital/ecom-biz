"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export type NavItem = { href: string; label: string; exact?: boolean; children?: { href: string; label: string }[] };

export function AdminShell({
  platformName,
  storeName,
  storeUrl,
  nav,
  stores,
  userName,
  labels,
  logoutAction,
  banner,
  children,
}: {
  platformName: string;
  storeName: string;
  storeUrl: string;
  nav: NavItem[];
  stores: { slug: string; name: string }[];
  userName: string;
  labels: { viewStore: string; menu: string; switchStore: string; allStores: string; logout: string };
  logoutAction: () => Promise<void>;
  banner?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const isActive = (item: { href: string; exact?: boolean }) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface px-4 lg:hidden">
        <button onClick={() => setOpen((o) => !o)} className="rounded-md px-2 py-1 text-sm font-medium hover:bg-surface-2" aria-expanded={open}>
          ☰ {labels.menu}
        </button>
        <span className="truncate text-sm font-semibold">{storeName}</span>
      </header>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-border bg-sidebar transition-transform lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="border-b border-border px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">{platformName}</p>
          <details className="group relative mt-1">
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-md py-1 text-sm font-semibold">
              <span className="truncate">{storeName}</span>
              <span className="text-muted" aria-hidden>▾</span>
            </summary>
            <div className="absolute left-0 right-0 z-50 mt-1 rounded-lg border border-border bg-surface p-1 shadow-lg">
              <p className="px-2 py-1 text-xs text-muted">{labels.switchStore}</p>
              {stores.map((s) => (
                <Link key={s.slug} href={`/admin/${s.slug}`} className="block truncate rounded-md px-2 py-1.5 text-sm hover:bg-surface-2">
                  {s.name}
                </Link>
              ))}
              <Link href="/admin" className="block rounded-md px-2 py-1.5 text-sm text-muted hover:bg-surface-2">{labels.allStores}</Link>
            </div>
          </details>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Admin">
          <ul className="space-y-0.5">
            {nav.map((item) => {
              const active = isActive(item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "block rounded-md px-3 py-1.5 text-sm",
                      active ? "bg-surface font-semibold text-text shadow-sm" : "text-text/80 hover:bg-surface/60",
                    )}
                  >
                    {item.label}
                  </Link>
                  {item.children && active && (
                    <ul className="mb-1 ml-3 mt-0.5 space-y-0.5 border-l border-border pl-2">
                      {item.children.map((c) => (
                        <li key={c.href}>
                          <Link
                            href={c.href}
                            className={cn("block rounded-md px-2 py-1 text-sm", pathname.startsWith(c.href) ? "font-medium text-text" : "text-muted hover:text-text")}
                          >
                            {c.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="space-y-2 border-t border-border p-3">
          <a href={storeUrl} target="_blank" rel="noreferrer" className="block rounded-md px-3 py-1.5 text-sm hover:bg-surface/60">
            {labels.viewStore} ↗
          </a>
          <div className="flex items-center justify-between px-3 text-xs text-muted">
            <span className="truncate">{userName}</span>
            <form action={logoutAction}>
              <button className="hover:text-text">{labels.logout}</button>
            </form>
          </div>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setOpen(false)} aria-hidden />}

      <div className="min-w-0">
        {banner}
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
