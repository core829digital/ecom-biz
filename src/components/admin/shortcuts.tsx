"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { useT } from "@/components/i18n-provider";

const isTyping = (el: EventTarget | null) => {
  const n = el as HTMLElement | null;
  return !!n && (n.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(n.tagName));
};

/**
 * Global keyboard shortcuts (Discord/Linear style):
 *   G then H/O/P/C/D/S/T  → go to a section
 *   Alt + ↑ / ↓           → previous / next store
 *   N                      → new product
 *   ?                      → this help
 */
export function KeyboardShortcuts({ slug, stores }: { slug: string; stores: string[] }) {
  const t = useT();
  const router = useRouter();
  const [help, setHelp] = useState(false);
  const pendingG = useRef<number | null>(null);
  const base = `/admin/${slug}`;

  useEffect(() => {
    const routes: Record<string, string> = {
      h: base, o: `${base}/orders`, p: `${base}/products`, c: `${base}/customers`,
      d: `${base}/discounts`, s: `${base}/settings`, t: `${base}/online-store/theme`, i: `${base}/products/inventory`,
    };
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || document.querySelector("[role=dialog]")) return;
      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        const i = stores.indexOf(slug);
        const next = stores[(i + (e.key === "ArrowDown" ? 1 : -1) + stores.length) % stores.length];
        if (next && next !== slug) router.push(`/admin/${next}`);
        return;
      }
      if (e.altKey) return;
      const key = e.key.toLowerCase();
      if (pendingG.current !== null) {
        window.clearTimeout(pendingG.current);
        pendingG.current = null;
        if (routes[key]) {
          e.preventDefault();
          router.push(routes[key]);
        }
        return;
      }
      if (key === "g") {
        pendingG.current = window.setTimeout(() => (pendingG.current = null), 1200);
      } else if (key === "n") {
        e.preventDefault();
        router.push(`${base}/products/new`);
      } else if (e.key === "?") {
        e.preventDefault();
        setHelp(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [base, router, slug, stores]);

  const rows: [string[], string][] = [
    [["Ctrl", "K"], t("shortcuts.palette")],
    [["G", "H"], t("nav.home")],
    [["G", "O"], t("nav.orders")],
    [["G", "P"], t("nav.products")],
    [["G", "I"], t("nav.inventory")],
    [["G", "C"], t("nav.customers")],
    [["G", "D"], t("nav.discounts")],
    [["G", "T"], t("nav.theme")],
    [["G", "S"], t("nav.settings")],
    [["N"], t("products.add")],
    [["Alt", "↑ / ↓"], t("shortcuts.switchStore")],
    [["?"], t("shortcuts.help")],
  ];
  return (
    <Dialog open={help} onClose={() => setHelp(false)} title={t("shortcuts.title")}>
      <ul className="divide-y divide-border text-sm">
        {rows.map(([keys, label]) => (
          <li key={label} className="flex items-center justify-between py-2">
            <span>{label}</span>
            <span className="flex gap-1">{keys.map((k) => <kbd key={k} className="min-w-6 rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-center text-xs font-medium">{k}</kbd>)}</span>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
