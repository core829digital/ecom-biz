"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CreditCard, LogOut, Palette, Shield, User, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

const ICONS: Record<string, LucideIcon> = { user: User, shield: Shield, palette: Palette, card: CreditCard };

export function SettingsShell({
  userName, groups, labels, logoutAction, children,
}: {
  userName: string;
  groups: { title: string; items: { href: string; label: string; icon: string }[] }[];
  labels: { close: string; logout: string };
  logoutAction: () => Promise<void>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const reduce = useReducedMotion();
  const close = () => (window.history.length > 1 ? router.back() : router.push("/admin"));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[role=dialog]")) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      className="min-h-dvh bg-bg md:grid md:grid-cols-[minmax(220px,1fr)_minmax(0,760px)_minmax(80px,1fr)]"
      initial={reduce ? false : { opacity: 0, scale: 1.015 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
    >
      <nav className="border-b border-border bg-surface-2 md:flex md:justify-end md:border-b-0 md:border-r" aria-label="Settings">
        <div className="w-full px-4 py-6 md:w-[230px] md:py-14">
          <p className="mb-4 truncate px-2 text-sm font-semibold">{userName}</p>
          {groups.map((g) => (
            <div key={g.title} className="mb-5">
              <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">{g.title}</p>
              <ul className="flex gap-1 overflow-x-auto md:block md:space-y-0.5">
                {g.items.map((i) => {
                  const Icon = ICONS[i.icon] ?? User;
                  const active = pathname === i.href;
                  return (
                    <li key={i.href} className="shrink-0">
                      <Link href={i.href} aria-current={active ? "page" : undefined}
                        className={cn("relative flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors", active ? "font-medium text-text" : "text-muted hover:bg-surface-3/60 hover:text-text")}>
                        {active && <motion.span layoutId="settings-active" className="absolute inset-0 rounded-md bg-surface-3" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                        <Icon className="relative size-4" aria-hidden />
                        <span className="relative whitespace-nowrap">{i.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <div className="border-t border-border pt-3">
            <form action={logoutAction}>
              <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-danger hover:bg-surface-3/60"><LogOut className="size-4" aria-hidden /> {labels.logout}</button>
            </form>
          </div>
        </div>
      </nav>
      <main className="min-w-0 px-4 py-8 sm:px-8 md:py-14">{children}</main>
      <div className="hidden md:block">
        <div className="sticky top-14 pl-4">
          <button onClick={close} className="group flex flex-col items-center gap-1 text-muted hover:text-text" aria-label={labels.close}>
            <span className="flex size-9 items-center justify-center rounded-full border-2 border-current transition-transform group-hover:scale-105"><X className="size-4" /></span>
            <span className="text-[11px] font-semibold">ESC</span>
          </button>
        </div>
      </div>
      <button onClick={close} className="fixed right-4 top-4 rounded-full border border-border bg-surface p-2 shadow-soft md:hidden" aria-label={labels.close}><X className="size-4" /></button>
    </motion.div>
  );
}
