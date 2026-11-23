"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Lock, Plus, Settings, Shield } from "lucide-react";
import { useT } from "@/components/i18n-provider";

type S = { slug: string; name: string; role: string; status: string; pending: number };

export function StoreGrid({ platformName, userName, isPlatformAdmin, canCreate, usage, stores }: {
  platformName: string; userName: string; isPlatformAdmin: boolean; canCreate: boolean; usage: { owned: number; limit: number; plan: string }; stores: S[];
}) {
  const t = useT();
  const reduce = useReducedMotion();
  const container = { hidden: {}, show: { transition: { staggerChildren: reduce ? 0 : 0.05 } } };
  const item = { hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 380, damping: 30 } } };
  const pct = Math.min(100, Math.round((usage.owned / Math.max(1, usage.limit)) * 100));
  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{platformName}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t("stores.welcome", { name: userName.split(" ")[0] })}</h1>
          <p className="mt-1 text-muted">{t("stores.pick")}</p>
        </div>
        <div className="flex items-center gap-2">
          {isPlatformAdmin && <Link href="/platform" className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-2"><Shield className="size-4" aria-hidden /> {t("platform.title")}</Link>}
          <Link href="/account" className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-2"><Settings className="size-4" aria-hidden /> {t("account.title")}</Link>
        </div>
      </header>

      <motion.ul variants={container} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stores.map((s) => (
          <motion.li key={s.slug} variants={item}>
            <Link href={`/admin/${s.slug}`} className="group relative flex h-full flex-col rounded-2xl border border-border bg-surface p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-border-strong hover:shadow-elevated">
              <div className="flex items-start justify-between">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-accent text-base font-semibold text-accent-contrast transition-[border-radius] group-hover:rounded-xl">
                  {s.name.slice(0, 2).toUpperCase()}
                </span>
                <ArrowUpRight className="size-4 text-muted opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
              </div>
              <p className="mt-4 truncate font-semibold">{s.name}</p>
              <p className="text-sm text-muted">{s.slug} · {s.role}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {s.pending > 0 && <span className="rounded-full bg-danger-bg px-2 py-0.5 font-medium text-danger">{t("stores.toFulfill", { count: s.pending })}</span>}
                {s.status !== "ACTIVE" && <span className="rounded-full bg-warning-bg px-2 py-0.5 font-medium text-warning">{t(`platform.storeStatus.${s.status as "SUSPENDED"}`)}</span>}
              </div>
            </Link>
          </motion.li>
        ))}
        <motion.li variants={item}>
          <Link
            href={canCreate ? "/admin/new" : "/account/billing"}
            className="group flex h-full min-h-44 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border p-5 text-center transition-colors hover:border-border-strong hover:bg-surface"
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-muted transition-transform group-hover:scale-110 group-hover:text-text">
              {canCreate ? <Plus className="size-6" aria-hidden /> : <Lock className="size-5" aria-hidden />}
            </span>
            <span className="font-medium">{canCreate ? t("stores.create") : t("usage.limitStores")}</span>
            <span className="w-full max-w-48">
              <span className="flex justify-between text-xs text-muted"><span>{usage.plan}</span><span className="tabular-nums">{usage.owned} / {usage.limit}</span></span>
              <span className="mt-1 block h-1 overflow-hidden rounded-full bg-surface-3"><span className={`block h-full rounded-full ${pct >= 100 ? "bg-danger" : "bg-accent"}`} style={{ width: `${pct}%` }} /></span>
            </span>
          </Link>
        </motion.li>
      </motion.ul>
    </main>
  );
}
