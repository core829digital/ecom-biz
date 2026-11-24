"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CornerDownLeft, Loader2, Package, Plus, Search, ShoppingBag, Store, User, Moon, Sun, type LucideIcon } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import { cn } from "@/lib/cn";
import { applyAppearance } from "@/components/appearance/theme-switcher";
import { setAppearanceAction } from "@/components/appearance/actions";
import { paletteSearchAction, type PaletteResult } from "./palette-actions";

type Item = { id: string; group: string; label: string; detail?: string; icon: LucideIcon; run: () => void; keywords?: string };

/**
 * Quick switcher (Ctrl/⌘ K): jump to any page, store or record, and run common actions.
 * Fully keyboard-driven: ↑/↓ to move, Enter to run, Esc to close.
 */
export function CommandPalette({ slug, stores }: { slug: string; stores: { slug: string; name: string }[] }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<PaletteResult[]>([]);
  const [searching, startSearch] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const base = `/admin/${slug}`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setIndex(0);
      window.setTimeout(() => input.current?.focus(), 10);
    }
  }, [open]);

  // Debounced live search
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const id = window.setTimeout(() => startSearch(async () => setResults(await paletteSearchAction(slug, query))), 180);
    return () => window.clearTimeout(id);
  }, [query, slug]);

  const go = (href: string) => () => {
    setOpen(false);
    router.push(href);
  };

  const staticItems: Item[] = useMemo(() => {
    const pages = t("palette.pages");
    const actions = t("palette.actions");
    const nav: [string, string][] = [
      [t("nav.home"), base], [t("nav.orders"), `${base}/orders`], [t("nav.products"), `${base}/products`], [t("nav.inventory"), `${base}/products/inventory`],
      [t("nav.collections"), `${base}/collections`], [t("nav.customers"), `${base}/customers`], [t("nav.reviews"), `${base}/reviews`], [t("nav.inbox"), `${base}/inbox`], [t("nav.marketing"), `${base}/marketing`], [t("nav.blog"), `${base}/online-store/blog`], [t("nav.discounts"), `${base}/discounts`],
      [t("nav.theme"), `${base}/online-store/theme`], [t("nav.pages"), `${base}/online-store/pages`], [t("nav.navigation"), `${base}/online-store/navigation`],
      [t("nav.domains"), `${base}/online-store/domains`], [t("nav.payments"), `${base}/settings/payments`], [t("nav.shipping"), `${base}/settings/shipping`],
      [t("nav.taxes"), `${base}/settings/taxes`], [t("nav.staff"), `${base}/settings/staff`], [t("nav.developers"), `${base}/settings/developers`],
      [t("nav.audit"), `${base}/settings/audit`], [t("nav.billing"), "/account/billing"], [t("account.title"), "/account"],
    ];
    const setTheme = (theme: "light" | "dark") => () => {
      const accent = (document.documentElement.getAttribute("data-accent") as "neutral") ?? "neutral";
      applyAppearance(theme, accent);
      void setAppearanceAction(theme, accent);
      setOpen(false);
    };
    return [
      { id: "a-product", group: actions, label: t("products.add"), icon: Plus, run: go(`${base}/products/new`) },
      { id: "a-discount", group: actions, label: t("discounts.add"), icon: Plus, run: go(`${base}/discounts/new`) },
      { id: "a-customer", group: actions, label: t("customers.add"), icon: Plus, run: go(`${base}/customers/new`) },
      { id: "a-light", group: actions, label: t("palette.lightMode"), icon: Sun, run: setTheme("light") },
      { id: "a-dark", group: actions, label: t("palette.darkMode"), icon: Moon, run: setTheme("dark") },
      ...nav.map(([label, href]) => ({ id: `p-${href}`, group: pages, label, icon: ArrowRight, run: go(href) })),
      ...stores.filter((s) => s.slug !== slug).map((s) => ({ id: `s-${s.slug}`, group: t("palette.stores"), label: s.name, icon: Store, run: go(`/admin/${s.slug}`) })),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, base, slug, stores]);

  const items: Item[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? staticItems.filter((i) => i.label.toLowerCase().includes(q)) : staticItems;
    const icons = { product: Package, order: ShoppingBag, customer: User };
    const live = results.map((r, i) => ({ id: `r-${i}-${r.href}`, group: t(`palette.${r.kind}s`), label: r.label, detail: r.detail, icon: icons[r.kind], run: go(r.href) }));
    return [...live, ...filtered];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, results, staticItems, t]);

  useEffect(() => setIndex(0), [query, results.length]);
  useEffect(() => {
    list.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
  }, [index]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIndex((i) => Math.min(items.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); items[index]?.run(); }
    else if (e.key === "Escape") setOpen(false);
  };

  if (typeof document === "undefined") return null;
  let lastGroup = "";
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh]">
          <motion.div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} onClick={() => setOpen(false)} aria-hidden />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t("palette.placeholder")}
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-surface shadow-elevated"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 500, damping: 36 }}
            onKeyDown={onKeyDown}
          >
            <div className="flex items-center gap-3 border-b border-border px-4">
              {searching ? <Loader2 className="size-4 animate-spin text-muted" aria-hidden /> : <Search className="size-4 text-muted" aria-hidden />}
              <input
                ref={input}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("palette.placeholder")}
                className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted focus-visible:outline-none"
                role="combobox"
                aria-expanded="true"
                aria-controls="palette-list"
                aria-activedescendant={items[index] ? `pi-${index}` : undefined}
              />
              <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">Esc</kbd>
            </div>
            <ul ref={list} id="palette-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
              {items.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted">{t("products.noResults")}</li>}
              {items.map((item, i) => {
                const header = item.group !== lastGroup ? item.group : null;
                lastGroup = item.group;
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    {header && <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted first:pt-1">{header}</p>}
                    <button
                      id={`pi-${i}`}
                      data-index={i}
                      role="option"
                      aria-selected={i === index}
                      onMouseMove={() => setIndex(i)}
                      onClick={item.run}
                      className={cn("relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm", i === index ? "text-text" : "text-text/85")}
                    >
                      {i === index && <motion.span layoutId="palette-active" className="absolute inset-0 rounded-lg bg-surface-2" transition={{ type: "spring", stiffness: 600, damping: 40 }} />}
                      <Icon className="relative size-4 shrink-0 text-muted" aria-hidden />
                      <span className="relative flex-1 truncate">{item.label}</span>
                      {item.detail && <span className="relative truncate text-xs text-muted">{item.detail}</span>}
                      {i === index && <CornerDownLeft className="relative size-3.5 text-muted" aria-hidden />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
