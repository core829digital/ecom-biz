"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Reveals storefront sections as they scroll into view. The look of each entrance lives in CSS
 * (globals.css, "Storefront motion"); this only flips `data-in` once an element is visible.
 * People who ask their system for reduced motion get everything shown at once.
 */
export function MotionRuntime() {
  const pathname = usePathname();
  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]:not([data-in])"));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      items.forEach((el) => el.setAttribute("data-in", ""));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.setAttribute("data-in", "");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    items.forEach((el) => io.observe(el));
    // Safety net: never leave content hidden (e.g. printing, odd viewports).
    const fallback = window.setTimeout(() => items.forEach((el) => el.setAttribute("data-in", "")), 6000);
    return () => { io.disconnect(); window.clearTimeout(fallback); };
  }, [pathname]);
  return null;
}
