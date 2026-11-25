"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Thin progress bar in the brand color while a client-side navigation is in flight.
 * Starts on clicks on same-origin links and stops when the URL changes. (A route-level
 * loading.tsx would also wrap Server Action refreshes in Suspense and leave forms pending.)
 */
export function NavProgress({ barClassName = "bg-brand" }: { barClassName?: string } = {}) {
  const pathname = usePathname();
  const search = useSearchParams();
  const [active, setActive] = useState(false);

  useEffect(() => setActive(false), [pathname, search]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // same page / hash
      setActive(true);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (!active) return;
    const safety = setTimeout(() => setActive(false), 15_000);
    return () => clearTimeout(safety);
  }, [active]);

  if (!active) return null;
  return (
    <div role="progressbar" aria-label="Loading" className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden">
      <div className={`sf-progress h-full w-1/3 ${barClassName}`} />
    </div>
  );
}
