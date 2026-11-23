"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Menu, X } from "lucide-react";

/**
 * Storefront menu for small screens: closes on Escape, outside tap and navigation,
 * returns focus to the toggle, and navigates client-side.
 */
export function MobileNav({ items, label, closeLabel }: { items: { title: string; href: string }[]; label: string; closeLabel: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  if (!items.length) return null;
  return (
    <div ref={root} className="relative md:hidden">
      <button
        ref={toggle}
        type="button"
        className="-ml-2 flex size-10 items-center justify-center rounded-lg hover:bg-surface-2"
        aria-expanded={open}
        aria-controls={id}
        aria-label={open ? closeLabel : label}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.nav
            id={id}
            aria-label={label}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
            className="absolute left-0 top-full z-40 mt-2 w-64 origin-top-left rounded-xl border border-border bg-bg p-1.5 shadow-lg"
          >
            {items.map((i) => (
              <Link key={i.title + i.href} href={i.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 hover:bg-surface-2">
                {i.title}
              </Link>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </div>
  );
}
