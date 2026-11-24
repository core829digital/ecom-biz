"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring } from "framer-motion";
import { Check, CreditCard, Globe, Keyboard, Lock, Package, Palette, Store, Truck, Webhook, X } from "lucide-react";
import { MaskReveal, MorphPlus, PillButton, TiltCard } from "./motion-ui";
import type { LandingCopy } from "@/lib/i18n/landing";
import { cn } from "@/lib/cn";
import { ease } from "./hero";

const reveal = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease } },
};

function SectionTitle({ eyebrow, title }: { eyebrow?: string; title: string }) {
  return (
    <div className="mx-auto mb-16 max-w-3xl text-center sm:mb-20">
      {eyebrow && (
        <motion.p variants={reveal} initial="hidden" whileInView="show" viewport={{ once: true }} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-muted">
          {eyebrow}
        </motion.p>
      )}
      <MaskReveal text={title} className="mt-5 text-balance text-4xl font-semibold leading-[1.02] tracking-[-0.04em] sm:text-6xl" />
    </div>
  );
}

export function Marquee({ items }: { items: string[] }) {
  return (
    <section className="border-y border-border bg-surface/50 py-6" aria-label="Industries">
      <div className="group relative flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
        {[0, 1].map((k) => (
          <ul key={k} aria-hidden={k === 1} className="flex shrink-0 animate-[marquee_40s_linear_infinite] items-center gap-12 pr-12 group-hover:[animation-play-state:paused]">
            {items.map((i) => <li key={i} className="whitespace-nowrap text-lg font-medium text-muted">{i}</li>)}
          </ul>
        ))}
      </div>
    </section>
  );
}

export function Stats({ stats }: { stats: LandingCopy["stats"] }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <motion.ul initial="hidden" whileInView="show" viewport={{ once: true }} transition={{ staggerChildren: 0.08 }} className="grid grid-cols-2 gap-y-10 lg:grid-cols-4">
        {stats.map((s) => (
          <motion.li key={s.label} variants={reveal} className="text-center">
            <p className="text-5xl font-semibold tracking-tighter sm:text-6xl">{s.value}</p>
            <p className="mt-2 text-sm text-muted">{s.label}</p>
          </motion.li>
        ))}
      </motion.ul>
    </section>
  );
}

/* ── Feature micro-animations ─────────────────────────────── */

function ThemesDemo({ shop }: { shop: string }) {
  const palettes = [["#111111", "#ffffff"], ["#fafafa", "#0a0a0b"], ["#7c5a3a", "#f7f3ec"], ["#2f5d46", "#f6f7f2"], ["#b4436c", "#fff7f8"]];
  const [i, setI] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setI((x) => (x + 1) % palettes.length), 1800);
    return () => clearInterval(id);
  }, [reduce, palettes.length]);
  const [brand, bg] = palettes[i];
  return (
    <motion.div animate={{ backgroundColor: bg }} transition={{ duration: 0.6 }} className="mt-6 rounded-xl border border-border p-4" aria-hidden>
      <motion.div animate={{ backgroundColor: brand }} className="h-2 w-16 rounded-full" />
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((k) => <motion.div key={k} animate={{ backgroundColor: brand, opacity: 0.15 + k * 0.1 }} className="aspect-square rounded-lg" />)}
      </div>
      <motion.span animate={{ backgroundColor: brand, color: bg }} className="mt-3 inline-block rounded-full px-3 py-1 text-[10px] font-semibold">{shop}</motion.span>
    </motion.div>
  );
}

function StoresDemo() {
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setActive((a) => (a + 1) % 4), 1500);
    return () => clearInterval(id);
  }, [reduce]);
  return (
    <div className="mt-6 flex gap-3" aria-hidden>
      {["AT", "NB", "LX", "VG"].map((s, i) => (
        <div key={s} className="relative flex flex-col items-center">
          <motion.span animate={{ borderRadius: active === i ? 14 : 24 }} className={cn("flex size-12 items-center justify-center text-xs font-semibold", active === i ? "bg-text text-bg" : "bg-surface-2 text-muted")}>{s}</motion.span>
          <motion.span animate={{ opacity: active === i ? 1 : 0, scaleX: active === i ? 1 : 0.3 }} className="mt-2 h-1 w-6 rounded-full bg-text" />
          {i === 1 && <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">3</span>}
        </div>
      ))}
    </div>
  );
}

function PaletteDemo() {
  const words = ["#1043", "Linen Shirt", "Refund…", "Theme"];
  const [w, setW] = useState(0);
  const [text, setText] = useState("");
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) { setText(words[0]); return; }
    let i = 0;
    const target = words[w];
    const type = setInterval(() => {
      i++;
      setText(target.slice(0, i));
      if (i >= target.length) {
        clearInterval(type);
        setTimeout(() => setW((x) => (x + 1) % words.length), 1100);
      }
    }, 70);
    return () => clearInterval(type);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, reduce]);
  return (
    <div className="mt-6 rounded-xl border border-border bg-surface p-3 shadow-soft" aria-hidden>
      <div className="flex items-center gap-2 border-b border-border pb-2 text-sm">
        <Keyboard className="size-4 text-muted" />
        <span>{text}<span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-text align-middle" /></span>
        <kbd className="ml-auto rounded border border-border px-1.5 text-[10px] text-muted">Ctrl K</kbd>
      </div>
      <div className="mt-2 space-y-1">
        {[0, 1].map((k) => <div key={k} className={cn("h-6 rounded-md", k === 0 ? "bg-surface-2" : "")}><span className="ml-2 mt-2 inline-block h-1.5 w-24 rounded-full bg-surface-3" /></div>)}
      </div>
    </div>
  );
}

function ApiDemo() {
  return (
    <pre className="mt-6 overflow-hidden rounded-xl border border-border bg-[#0b0b0d] p-4 text-[11px] leading-relaxed text-zinc-300" aria-hidden>
      <code>
        <span className="text-zinc-500">POST</span> /api/v1/inventory{"\n"}
        {"{"} <span className="text-emerald-400">&quot;sku&quot;</span>: <span className="text-amber-300">&quot;MUG-W&quot;</span>, <span className="text-emerald-400">&quot;adjustment&quot;</span>: <span className="text-sky-300">-3</span> {"}"}{"\n"}
        <span className="text-zinc-500">→ 200</span> {"{"} <span className="text-emerald-400">&quot;available&quot;</span>: <span className="text-sky-300">7</span> {"}"}
      </code>
    </pre>
  );
}

function OrdersDemo({ steps }: { steps: string[] }) {
  const [s, setS] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setS((x) => (x + 1) % (steps.length + 1)), 1100);
    return () => clearInterval(id);
  }, [reduce, steps.length]);
  return (
    <ol className="mt-6 flex items-center gap-2" aria-hidden>
      {steps.map((label, i) => (
        <li key={label} className="flex flex-1 flex-col items-center gap-1.5">
          <motion.span animate={{ backgroundColor: i < s ? "var(--accent)" : "var(--surface-3)", scale: i === s - 1 ? 1.12 : 1 }} className="flex size-7 items-center justify-center rounded-full text-accent-contrast">
            {i < s && <Check className="size-3.5" />}
          </motion.span>
          <span className="text-[10px] text-muted">{label}</span>
        </li>
      ))}
    </ol>
  );
}

export function Features({ copy, mock }: { copy: LandingCopy["features"]; mock: LandingCopy["mock"] }) {
  const f = copy.items;
  const cards: { key: keyof typeof f; icon: typeof Palette; className: string; demo?: React.ReactNode }[] = [
    { key: "themes", icon: Palette, className: "lg:col-span-2", demo: <ThemesDemo shop={mock.shop} /> },
    { key: "stores", icon: Store, className: "", demo: <StoresDemo /> },
    { key: "checkout", icon: CreditCard, className: "" },
    { key: "palette", icon: Keyboard, className: "", demo: <PaletteDemo /> },
    { key: "orders", icon: Package, className: "", demo: <OrdersDemo steps={mock.steps} /> },
    { key: "api", icon: Webhook, className: "lg:col-span-2", demo: <ApiDemo /> },
    { key: "security", icon: Lock, className: "" },
    { key: "global", icon: Truck, className: "sm:col-span-2 lg:col-span-3" },
  ];
  return (
    <section id="features" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-28 sm:py-36 sm:px-6">
      <SectionTitle eyebrow={copy.eyebrow} title={copy.title} />
      <motion.ul initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} transition={{ staggerChildren: 0.06 }} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ key, icon: Icon, className, demo }) => (
          <motion.li key={key} variants={reveal} className={className}>
            <TiltCard className="h-full overflow-hidden rounded-3xl border border-border bg-surface p-7 shadow-soft transition-[box-shadow,border-color] duration-300 hover:border-text/20 hover:shadow-elevated sm:p-8">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-surface-2 transition-all duration-300 group-hover:rotate-[-6deg] group-hover:scale-110 group-hover:bg-text group-hover:text-bg"><Icon className="size-5" aria-hidden /></span>
              <h3 className="mt-6 text-lg font-semibold tracking-tight">{f[key].title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f[key].body}</p>
              {demo}
            </TiltCard>
          </motion.li>
        ))}
      </motion.ul>
    </section>
  );
}

export function HowItWorks({ copy }: { copy: LandingCopy["how"] }) {
  const ref = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 75%", "end 55%"] });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });
  return (
    <section id="how" className="scroll-mt-20 border-y border-border bg-surface/40 py-28 sm:py-36">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionTitle eyebrow={copy.eyebrow} title={copy.title} />
        <ol ref={ref} className="relative space-y-12 pl-14">
          <span className="absolute bottom-2 left-[19px] top-2 w-px bg-border" aria-hidden />
          <motion.span className="absolute left-[19px] top-2 w-px origin-top bg-text" style={{ scaleY: progress, height: "calc(100% - 16px)" }} aria-hidden />
          {copy.steps.map((s, i) => (
            <motion.li key={s.title} variants={reveal} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-100px" }} className="relative">
              <span className="absolute -left-14 flex size-10 items-center justify-center rounded-full border border-border bg-surface text-sm font-semibold shadow-soft">{i + 1}</span>
              <h3 className="text-xl font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-2 text-muted">{s.body}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Compare({ copy }: { copy: LandingCopy["compare"] }) {
  return (
    <section className="mx-auto max-w-4xl px-4 py-28 sm:py-36 sm:px-6">
      <SectionTitle eyebrow={copy.eyebrow} title={copy.title} />
      <motion.div variants={reveal} initial="hidden" whileInView="show" viewport={{ once: true }} className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-6 border-b border-border bg-surface-2 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted sm:gap-x-10">
          <span />
          <span className="w-20 text-center text-text sm:w-28">{copy.us}</span>
          <span className="w-20 text-center sm:w-28">{copy.them}</span>
        </div>
        <ul>
          {copy.rows.map(([feature, them], i) => (
            <motion.li key={feature} initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05, duration: 0.5, ease }}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 border-b border-border px-5 py-4 text-sm last:border-0 sm:gap-x-10">
              <span className="font-medium">{feature}</span>
              <span className="flex w-20 justify-center sm:w-28"><span className="flex size-6 items-center justify-center rounded-full bg-success-bg text-success"><Check className="size-3.5" aria-label="Included" /></span></span>
              <span className="w-20 text-center text-xs text-muted sm:w-28"><X className="mx-auto mb-0.5 size-3.5" aria-hidden />{them}</span>
            </motion.li>
          ))}
        </ul>
      </motion.div>
    </section>
  );
}

export type LandingPlan = { id: string; name: string; price: string; fee: string; stores: number; products: number | null; features: string[] };

export function Pricing({ copy, plans }: { copy: LandingCopy["pricing"]; plans: LandingPlan[] }) {
  const popular = plans.length >= 3 ? 1 : -1;
  return (
    <section id="pricing" className="scroll-mt-20 border-y border-border bg-surface/40 py-28 sm:py-36">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionTitle eyebrow={copy.eyebrow} title={copy.title} />
        <motion.ul initial="hidden" whileInView="show" viewport={{ once: true }} transition={{ staggerChildren: 0.08 }} className={cn("mx-auto grid gap-5", plans.length >= 3 ? "lg:grid-cols-3" : "max-w-3xl sm:grid-cols-2")}>
          {plans.map((p, i) => (
            <motion.li key={p.id} variants={reveal} className={cn("relative flex flex-col rounded-3xl p-[1px]", i === popular ? "bg-[conic-gradient(from_var(--angle),var(--text),transparent_40%,var(--text))] [animation:spin-border_6s_linear_infinite]" : "bg-border")}>
              {i === popular && <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-text px-3 py-1 text-xs font-semibold text-bg shadow-elevated">{copy.popular}</span>}
              <div className="flex h-full flex-col rounded-[calc(1.5rem-1px)] bg-surface p-7">
                <p className="text-lg font-semibold">{p.name}</p>
                <p className="mt-3 text-4xl font-semibold tracking-tight tabular-nums">{p.price}<span className="text-base font-normal text-muted"> / {copy.month}</span></p>
                <p className="mt-1 text-xs text-muted">{copy.fee.replace("{fee}", p.fee)}</p>
                <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                  {[p.stores === 1 ? copy.storesOne : copy.stores.replace("{count}", String(p.stores)), p.products === null ? copy.unlimitedProducts : copy.products.replace("{count}", String(p.products)), ...p.features].map((f) => (
                    <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" aria-hidden />{f}</li>
                  ))}
                </ul>
                <Link href="/signup" className={cn("mt-8 inline-flex h-12 items-center justify-center rounded-full text-sm font-medium transition-[transform,box-shadow,background-color] duration-300 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]", i === popular ? "bg-text text-bg hover:shadow-[0_14px_30px_-12px_rgb(0_0_0/0.5)]" : "border border-border bg-surface hover:bg-surface-2")}>{copy.cta}</Link>
              </div>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}

export function Faq({ copy }: { copy: LandingCopy["faq"] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-28 sm:py-36 sm:px-6">
      <SectionTitle title={copy.title} />
      <ul className="divide-y divide-border rounded-3xl border border-border bg-surface">
        {copy.items.map((item, i) => {
          const isOpen = open === i;
          return (
            <li key={item.q}>
              <button className="group flex w-full items-center justify-between gap-6 px-6 py-6 text-left text-[17px] font-medium sm:px-8" onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen}>
                {item.q}
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors duration-300", isOpen ? "border-text bg-text text-bg" : "border-border text-muted group-hover:border-text/40 group-hover:text-text")}>
                  <MorphPlus open={isOpen} className="size-3.5" />
                </span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease }} className="overflow-hidden">
                    <p className="px-6 pb-6 leading-relaxed text-muted sm:px-8">{item.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function FinalCta({ copy }: { copy: LandingCopy["cta"] }) {
  return (
    <section className="px-4 pb-24 sm:px-6">
      <motion.div variants={reveal} initial="hidden" whileInView="show" viewport={{ once: true }}
        className="relative mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] bg-text px-6 py-24 text-center text-bg sm:px-12 sm:py-32">
        <motion.div className="pointer-events-none absolute -left-24 -top-24 size-96 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--bg)_22%,transparent),transparent_65%)]"
          animate={{ x: [0, 80, 0], y: [0, 40, 0] }} transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }} aria-hidden />
        <motion.div className="pointer-events-none absolute -bottom-32 -right-16 size-[28rem] rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--bg)_16%,transparent),transparent_65%)]"
          animate={{ x: [0, -60, 0], y: [0, -30, 0] }} transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }} aria-hidden />
        <MaskReveal text={copy.title} className="relative mx-auto max-w-3xl text-balance text-4xl font-semibold leading-[1.02] tracking-[-0.04em] sm:text-7xl" />
        <p className="relative mt-6 text-lg opacity-70">{copy.subtitle}</p>
        <div className="relative mt-10">
          <PillButton href="/signup" variant="inverse">{copy.button}</PillButton>
        </div>
      </motion.div>
    </section>
  );
}

export function Footer({ copy, nav, brand, company }: { copy: LandingCopy["footer"]; nav: LandingCopy["nav"]; brand: string; company?: { name: string; vat: string } | null }) {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          <p className="flex items-center gap-2 font-semibold"><span className="flex size-7 items-center justify-center rounded-lg bg-text text-xs font-bold text-bg">{brand.slice(0, 1).toUpperCase()}</span>{brand}</p>
          <p className="mt-3 flex items-center gap-1.5 text-sm text-muted"><Globe className="size-4" aria-hidden /> EN · IT</p>
        </div>
        <div>
          <p className="text-sm font-semibold">{copy.product}</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li><a href="#features" className="hover:text-text">{nav.features}</a></li>
            <li><a href="#pricing" className="hover:text-text">{nav.pricing}</a></li>
            <li><a href="#faq" className="hover:text-text">{nav.faq}</a></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold">{copy.account}</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li><Link href="/login" className="hover:text-text">{nav.login}</Link></li>
            <li><Link href="/signup" className="hover:text-text">{nav.start}</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold">{copy.legal}</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li><Link href="/legal/terms" className="hover:text-text">{copy.terms}</Link></li>
            <li><Link href="/legal/privacy" className="hover:text-text">{copy.privacy}</Link></li>
            <li><Link href="/legal/cookies" className="hover:text-text">{copy.cookies}</Link></li>
            <li><Link href="/legal/subscriptions" className="hover:text-text">{copy.subscriptions}</Link></li>
          </ul>
        </div>
      </div>
      <p className="border-t border-border px-4 py-6 text-center text-xs text-muted">
        © {new Date().getFullYear()} {company ? company.name : brand}. {copy.rights}{company && <> · {copy.vat} {company.vat}</>}
      </p>
    </footer>
  );
}
