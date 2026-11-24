"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Bell, Mail, CheckCheck, CreditCard, MessageSquare, Package, Shield, ShoppingBag, UserPlus, Webhook } from "lucide-react";
import { cn } from "@/lib/cn";
import { listNotificationsAction, markAllReadAction, markReadAction, unreadCountAction, type NotificationItem } from "./actions";

const ICONS: Record<string, typeof Bell> = {
  order_new: ShoppingBag, low_stock: Package, review_pending: MessageSquare, order_dispute: AlertTriangle, webhook_failed: Webhook,
  staff_joined: UserPlus, contact_message: Mail, billing_trial_ending: CreditCard, billing_payment_failed: CreditCard, billing_hold: AlertTriangle,
  security_new_login: Shield, security_2fa_changed: Shield,
};

function timeAgo(iso: string, locale: string) {
  const s = Math.round((Date.parse(iso) - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const abs = Math.abs(s);
  if (abs < 60) return rtf.format(s, "second");
  if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour");
  return rtf.format(Math.round(s / 86400), "day");
}

/** Bell with unread badge and a popover of the latest notifications (polls every minute while visible). */
export function NotificationBell({ initialUnread, locale, labels }: {
  initialUnread: number;
  locale: string;
  labels: { title: string; empty: string; markAll: string; viewAll: string; open: string };
}) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [, start] = useTransition();
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const reduce = useReducedMotion();

  const load = useCallback(() => start(async () => {
    const res = await listNotificationsAction();
    setItems(res.items);
    setUnread(res.unread);
  }), []);

  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") unreadCountAction().then(setUnread).catch(() => {}); };
    const timer = setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, []);

  useEffect(() => {
    if (!open) return;
    load();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDown); };
  }, [open, load]);

  const openItem = (n: NotificationItem) => {
    setOpen(false);
    if (!n.read) {
      setUnread((u) => Math.max(0, u - 1));
      markReadAction(n.id).catch(() => {});
    }
    if (n.href) router.push(n.href);
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        aria-label={unread ? `${labels.title} (${unread})` : labels.title}
        className="relative flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text"
      >
        <Bell className="size-[18px]" aria-hidden />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white tabular-nums">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={id}
            role="dialog"
            aria-label={labels.title}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
            className="absolute right-0 top-full z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] origin-top-right overflow-hidden rounded-xl border border-border bg-surface shadow-elevated"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <p className="text-sm font-semibold">{labels.title}</p>
              {unread > 0 && (
                <button type="button" onClick={() => start(async () => { await markAllReadAction(); setUnread(0); setItems((xs) => xs?.map((x) => ({ ...x, read: true })) ?? null); })} className="flex items-center gap-1 text-xs text-muted hover:text-text">
                  <CheckCheck className="size-3.5" aria-hidden />{labels.markAll}
                </button>
              )}
            </div>
            <ul className="max-h-[min(28rem,70vh)] overflow-y-auto">
              {items === null && Array.from({ length: 3 }, (_, i) => <li key={i} className="px-4 py-3"><div className="skeleton h-10" /></li>)}
              {items?.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted">{labels.empty}</li>}
              {items?.map((n) => {
                const Icon = ICONS[n.type] ?? Bell;
                return (
                  <li key={n.id}>
                    <button type="button" onClick={() => openItem(n)} className={cn("flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2", !n.read && "bg-accent/5")}>
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2"><Icon className="size-4" aria-hidden /></span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className={cn("truncate text-sm", !n.read && "font-semibold")}>{n.title}</span>
                          {!n.read && <span className="size-2 shrink-0 rounded-full bg-accent" aria-hidden />}
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{n.body}</span>
                        <span className="mt-1 block text-[11px] text-muted">{[n.store, timeAgo(n.createdAt, locale)].filter(Boolean).join(" · ")}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <Link href="/account/notifications" onClick={() => setOpen(false)} className="block border-t border-border px-4 py-2.5 text-center text-sm font-medium hover:bg-surface-2">{labels.viewAll}</Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
