"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Check, Lock, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import type { LandingCopy } from "@/lib/i18n/landing";
import type { MarketingCopy } from "@/lib/i18n/marketing-pages";
import type { MarketingPlan } from "@/server/marketing-site";
import { ease, MaskReveal, MorphPlus, PillButton, TiltCard } from "./motion-ui";
import { FinalCta, Pricing } from "./sections";

/** Opening of every marketing page: eyebrow, word-by-word title, subtitle, soft grid backdrop. */
export function PageHero({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden pb-16 pt-36 sm:pb-24 sm:pt-44">
      <div className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_50%_0%,black_25%,transparent_70%)] opacity-50" aria-hidden />
      <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6">
        <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }} className="inline-flex rounded-full border border-border px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-muted">{eyebrow}</motion.p>
        <MaskReveal as="h1" immediate delay={0.1} text={title} className="mx-auto mt-6 max-w-4xl text-balance text-[clamp(2.4rem,6.5vw,5rem)] font-semibold leading-[1] tracking-[-0.045em]" />
        {subtitle && <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease, delay: 0.45 }} className="mx-auto mt-7 max-w-2xl text-pretty text-lg text-muted">{subtitle}</motion.p>}
        {children && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease, delay: 0.6 }} className="mt-10 flex flex-wrap justify-center gap-3">{children}</motion.div>}
      </div>
    </section>
  );
}

/* ── Features ─────────────────────────────────────────────────────── */

export function FeaturesPage({ pages, landing }: { pages: MarketingCopy; landing: LandingCopy }) {
  const f = pages.features;
  return (
    <>
      <PageHero eyebrow={f.eyebrow} title={f.title} subtitle={f.subtitle}>
        <PillButton href="/demo">{f.cta}</PillButton>
        <PillButton href="/signup" variant="ghost" arrow={false}>{pages.shared.start}</PillButton>
      </PageHero>
      <div className="mx-auto max-w-6xl space-y-28 px-4 pb-28 sm:space-y-40 sm:px-6 sm:pb-36">
        {f.blocks.map((b, i) => <FeatureRow key={b.key} block={b} flip={i % 2 === 1} pages={pages} />)}
      </div>
      <FinalCta copy={landing.cta} />
    </>
  );
}

function FeatureRow({ block, flip, pages }: { block: MarketingCopy["features"]["blocks"][number]; flip: boolean; pages: MarketingCopy }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [70, -70]);
  const rotate = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [flip ? -2 : 2, flip ? 2 : -2]);
  return (
    <div ref={ref} className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
      <div className={cn(flip && "md:order-2")}>
        <MaskReveal text={block.title} className="text-balance text-3xl font-semibold leading-[1.05] tracking-[-0.035em] sm:text-5xl" />
        <motion.p initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.7, ease, delay: 0.15 }} className="mt-5 text-pretty text-lg text-muted">{block.body}</motion.p>
        <ul className="mt-6 space-y-2.5">
          {block.points.map((p, n) => (
            <motion.li key={p} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, ease, delay: 0.25 + n * 0.08 }} className="flex items-start gap-3 text-sm">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-text text-bg"><Check className="size-3" aria-hidden /></span>{p}
            </motion.li>
          ))}
        </ul>
      </div>
      <motion.div style={{ y, rotate }} className={cn("will-change-transform", flip && "md:order-1")}>
        <TiltCard className="overflow-hidden rounded-3xl border border-border bg-surface p-5 shadow-[0_40px_100px_-40px_rgb(0_0_0/0.45)] sm:p-7">
          <FeatureVisual kind={block.key} pages={pages} />
        </TiltCard>
      </motion.div>
    </div>
  );
}

/** Abstract, product-like illustrations built from UI shapes (no screenshots to go stale). */
function FeatureVisual({ kind, pages }: { kind: string; pages: MarketingCopy }) {
  const v = pages.visual;
  const bar = "rounded-full bg-surface-3";
  const rise = (i: number) => ({ initial: { opacity: 0, y: 16 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { duration: 0.6, ease, delay: 0.1 + i * 0.08 } });
  switch (kind) {
    case "editor":
      return (
        <div className="grid h-72 grid-cols-[110px_1fr] gap-3" aria-hidden>
          <div className="space-y-2 rounded-xl bg-surface-2 p-2.5">
            {v.sections.map((s, i) => (
              <motion.div key={s} {...rise(i)} className={cn("rounded-lg px-2 py-1.5 text-[10px] font-medium", i === 0 ? "bg-text text-bg" : "bg-surface")}>{s}</motion.div>
            ))}
          </div>
          <div className="space-y-2.5 rounded-xl border border-border p-3">
            <motion.div {...rise(0)} className="flex h-20 flex-col justify-center rounded-lg bg-text px-3"><span className="h-2 w-24 rounded-full bg-bg/80" /><span className="mt-2 h-4 w-14 rounded-full bg-bg/90" /></motion.div>
            <div className="grid grid-cols-3 gap-2">{[0, 1, 2].map((i) => <motion.div key={i} {...rise(i + 1)} className="aspect-square rounded-lg bg-surface-2" />)}</div>
            <motion.div {...rise(4)} className="relative rounded-lg border-2 border-dashed border-text/40 px-3 py-2 text-[10px]">
              <span className="font-semibold">{v.story}</span><motion.span className="ml-0.5 inline-block h-3 w-px bg-text align-middle" animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }} />
            </motion.div>
          </div>
        </div>
      );
    case "motion":
      return (
        <div className="relative h-72 overflow-hidden rounded-xl bg-surface-2 p-5" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 40, filter: "blur(8px)" }} whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }} viewport={{ once: false, amount: 0.6 }} transition={{ duration: 0.9, ease, delay: i * 0.12 }}
              className="mb-3 flex items-center gap-3 rounded-xl bg-surface p-3 shadow-sm">
              <span className="size-10 rounded-lg bg-text/80" /><span className="flex-1 space-y-1.5"><span className={cn("block h-2 w-3/4", bar)} /><span className={cn("block h-2 w-1/2", bar)} /></span>
            </motion.div>
          ))}
        </div>
      );
    case "ai":
      return (
        <div className="flex h-72 flex-col justify-end gap-3 rounded-xl bg-surface-2 p-4 text-[12px]" aria-hidden>
          <motion.p {...rise(0)} className="ml-auto max-w-[75%] rounded-2xl rounded-br-md bg-text px-3 py-2 text-bg">{pages.demo.assistantPrompt}</motion.p>
          <motion.div {...rise(2)} className="max-w-[85%] rounded-2xl rounded-bl-md bg-surface px-3 py-2 shadow-sm">
            <p className="flex items-center gap-1.5 font-medium"><Sparkles className="size-3.5" />{v.done}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">{pages.demo.assistantChips.map((c) => <span key={c} className="rounded-full border border-border px-2 py-0.5 text-[10px]">{c} →</span>)}</div>
          </motion.div>
        </div>
      );
    case "marketing":
      return (
        <div className="flex h-72 items-center justify-center rounded-xl bg-surface-2" aria-hidden>
          <motion.div initial={{ rotate: -6, y: 30, opacity: 0 }} whileInView={{ rotate: -3, y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.9, ease }} className="w-64 overflow-hidden rounded-xl bg-surface shadow-xl">
            <div className="h-1.5 bg-text" />
            <div className="p-4">
              <p className="flex items-center gap-1.5 text-[11px] text-muted"><Mail className="size-3.5" />{v.newsletter}</p>
              <p className="mt-2 text-sm font-semibold">{v.newsletterTitle}</p>
              <span className={cn("mt-3 block h-2 w-full", bar)} /><span className={cn("mt-1.5 block h-2 w-4/5", bar)} />
              <span className="mt-4 inline-block rounded-md bg-text px-3 py-1.5 text-[10px] font-semibold text-bg">{v.discover}</span>
            </div>
          </motion.div>
        </div>
      );
    case "checkout":
      return (
        <div className="h-72 space-y-2.5 rounded-xl bg-surface-2 p-5" aria-hidden>
          {v.payments.map((m, i) => (
            <motion.div key={m} {...rise(i)} className={cn("flex items-center justify-between rounded-xl border bg-surface px-4 py-3 text-sm", i === 0 ? "border-text" : "border-border")}>
              {m}<span className={cn("size-4 rounded-full border-2", i === 0 ? "border-text bg-text" : "border-border")} />
            </motion.div>
          ))}
          <motion.div {...rise(3)} className="mt-4 flex h-11 items-center justify-center rounded-full bg-text text-sm font-medium text-bg">{v.pay}</motion.div>
        </div>
      );
    default:
      return (
        <div className="flex h-72 flex-col items-center justify-center gap-4 rounded-xl bg-surface-2" aria-hidden>
          <motion.span initial={{ scale: 0.6, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 220, damping: 14 }} className="flex size-16 items-center justify-center rounded-2xl bg-text text-bg"><ShieldCheck className="size-8" /></motion.span>
          <div className="space-y-1.5 text-xs">{["2FA", "GDPR", "Audit log"].map((x, i) => <motion.p key={x} {...rise(i + 1)} className="flex items-center gap-2"><Lock className="size-3" />{x}</motion.p>)}</div>
        </div>
      );
  }
}

/* ── Pricing ──────────────────────────────────────────────────────── */

export function PricingPage({ pages, landing, plans }: { pages: MarketingCopy; landing: LandingCopy; plans: MarketingPlan[] }) {
  const p = pages.pricing;
  const fmt = (n: number | null, unit = "") => (n === null ? p.unlimited : `${n.toLocaleString()}${unit}`);
  const rows: { label: string; value: (pl: MarketingPlan) => React.ReactNode }[] = [
    { label: p.rows.stores, value: (pl) => fmt(pl.stores) },
    { label: p.rows.products, value: (pl) => fmt(pl.products) },
    { label: p.rows.staff, value: (pl) => fmt(pl.staff) },
    { label: p.rows.storage, value: (pl) => (pl.storageMb === null ? p.unlimited : pl.storageMb >= 1000 ? `${pl.storageMb / 1000} GB` : `${pl.storageMb} MB`) },
    { label: p.rows.motion, value: (pl) => p.motion[Math.min(2, Math.max(0, pl.motion))] },
    { label: p.rows.css, value: (pl) => (pl.css ? <Check className="mx-auto size-4" aria-label={p.yes} /> : p.no) },
    { label: p.rows.api, value: (pl) => (pl.api ? <Check className="mx-auto size-4" aria-label={p.yes} /> : p.no) },
    { label: p.rows.domain, value: (pl) => (pl.domain ? <Check className="mx-auto size-4" aria-label={p.yes} /> : p.no) },
    { label: p.rows.fee, value: (pl) => `${pl.fee}%` },
  ];
  return (
    <>
      <PageHero eyebrow={p.eyebrow} title={p.title} subtitle={p.subtitle} />
      {plans.length > 0 && <div className="-mt-20"><Pricing copy={landing.pricing} plans={plans} /></div>}
      {plans.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 py-24 sm:px-6">
          <MaskReveal text={p.compareTitle} className="mb-10 text-center text-3xl font-semibold tracking-[-0.03em] sm:text-4xl" />
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, ease }} className="overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="border-b border-border bg-surface-2"><th className="px-5 py-4 text-left" />{plans.map((pl) => <th key={pl.id} className="px-4 py-4 text-center font-semibold">{pl.name}<span className="block text-xs font-normal text-muted">{pl.price}</span></th>)}</tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-b border-border last:border-0 transition-colors hover:bg-surface-2/60">
                    <td className="px-5 py-3.5 font-medium">{r.label}</td>
                    {plans.map((pl) => <td key={pl.id} className="px-4 py-3.5 text-center tabular-nums text-muted">{r.value(pl)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </section>
      )}
      <SimpleFaq title={p.faqTitle} items={p.faq} />
      <FinalCta copy={landing.cta} />
    </>
  );
}

function SimpleFaq({ title, items }: { title: string; items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section className="mx-auto max-w-3xl px-4 pb-28 sm:px-6">
      <MaskReveal text={title} className="mb-10 text-center text-3xl font-semibold tracking-[-0.03em] sm:text-4xl" />
      <ul className="divide-y divide-border rounded-3xl border border-border bg-surface">
        {items.map((item, i) => {
          const isOpen = open === i;
          return (
            <li key={item.q}>
              <button className="group flex w-full items-center justify-between gap-6 px-6 py-5 text-left font-medium sm:px-8" onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen}>
                {item.q}
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors duration-300", isOpen ? "border-text bg-text text-bg" : "border-border text-muted group-hover:text-text")}><MorphPlus open={isOpen} className="size-3.5" /></span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease }} className="overflow-hidden"><p className="px-6 pb-6 leading-relaxed text-muted sm:px-8">{item.a}</p></motion.div>}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ── About ────────────────────────────────────────────────────────── */

export function AboutPage({ pages, landing, company, contactEmail }: { pages: MarketingCopy; landing: LandingCopy; company: string | null; contactEmail: string | null }) {
  const a = pages.about;
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const x = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["8%", "-18%"]);
  return (
    <>
      <PageHero eyebrow={a.eyebrow} title={a.title} subtitle={a.subtitle} />
      <section ref={ref} className="overflow-hidden border-y border-border bg-surface/40 py-24 sm:py-32">
        <motion.p style={{ x }} className="whitespace-nowrap text-[clamp(3rem,10vw,8rem)] font-semibold leading-none tracking-[-0.05em] text-text/[0.06]" aria-hidden>{a.missionTitle} · {a.missionTitle} · {a.missionTitle}</motion.p>
        <div className="mx-auto -mt-10 max-w-3xl px-4 sm:-mt-16 sm:px-6">
          <MaskReveal text={a.missionTitle} className="text-3xl font-semibold tracking-[-0.03em] sm:text-5xl" />
          <motion.p initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease, delay: 0.15 }} className="mt-6 text-pretty text-xl leading-relaxed text-muted sm:text-2xl">{a.mission}</motion.p>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-28 sm:px-6 sm:py-36">
        <MaskReveal text={a.valuesTitle} className="mb-14 text-center text-3xl font-semibold tracking-[-0.03em] sm:text-5xl" />
        <ul className="grid gap-5 sm:grid-cols-2">
          {a.values.map((v, i) => (
            <motion.li key={v.title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.7, ease, delay: i * 0.08 }}>
              <TiltCard className="h-full rounded-3xl border border-border bg-surface p-8">
                <span className="text-sm font-semibold tabular-nums text-muted">0{i + 1}</span>
                <h3 className="mt-4 text-2xl font-semibold tracking-tight">{v.title}</h3>
                <p className="mt-3 leading-relaxed text-muted">{v.body}</p>
              </TiltCard>
            </motion.li>
          ))}
        </ul>
      </section>
      {company && (
        <section className="mx-auto max-w-3xl px-4 pb-28 text-center sm:px-6">
          <MaskReveal text={a.companyTitle} className="text-2xl font-semibold tracking-tight sm:text-4xl" />
          <p className="mt-4 text-lg text-muted">{a.company.replace("{company}", company)}</p>
          {contactEmail && <div className="mt-8"><PillButton href={`mailto:${contactEmail}`} variant="ghost">{a.contact}</PillButton></div>}
        </section>
      )}
      <FinalCta copy={landing.cta} />
    </>
  );
}

export function MarketingLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="underline underline-offset-4">{children}</Link>;
}
