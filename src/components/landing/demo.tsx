"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowUp, Check, Home, Package, Palette, ShoppingBag, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { contrastText, THEME_PRESETS } from "@/lib/theme";
import type { MarketingCopy } from "@/lib/i18n/marketing-pages";
import { ease, PillButton } from "./motion-ui";
import { PageHero } from "./pages";

type Tab = "home" | "orders" | "products" | "design" | "assistant";
const ICONS = { home: Home, orders: ShoppingBag, products: Package, design: Palette, assistant: Sparkles };

const SAMPLE = {
  it: { products: ["Candela al fico", "Candela al legno", "Diffusore lavanda", "Set regalo", "Candela agrumi", "Sapone all'olio"], names: ["Giulia R.", "Marco B.", "Elena V.", "Luca P.", "Sara T."], store: "Bottega Luna", tagline: "Candele fatte a mano" },
  en: { products: ["Fig candle", "Wood candle", "Lavender diffuser", "Gift set", "Citrus candle", "Olive soap"], names: ["Julia R.", "Mark B.", "Ellen V.", "Luke P.", "Sarah T."], store: "Luna Studio", tagline: "Handmade candles" },
};

/** Sandbox of the merchant admin with sample data. Nothing is persisted. */
export function DemoPage({ pages, locale }: { pages: MarketingCopy; locale: string }) {
  const d = pages.demo;
  return (
    <>
      <PageHero eyebrow={d.eyebrow} title={d.title} subtitle={d.subtitle} />
      <section className="mx-auto -mt-6 max-w-6xl px-3 pb-24 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 40, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.9, ease, delay: 0.5 }}>
          <DemoApp d={d} sample={SAMPLE[locale === "it" ? "it" : "en"]} />
        </motion.div>
        <div className="mt-12 flex flex-col items-center gap-3 text-center">
          <PillButton href="/signup">{d.cta}</PillButton>
          <p className="text-xs text-muted">{d.note}</p>
        </div>
      </section>
    </>
  );
}

function DemoApp({ d, sample }: { d: MarketingCopy["demo"]; sample: (typeof SAMPLE)["it"] }) {
  const [tab, setTab] = useState<Tab>("home");
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_50px_140px_-50px_rgb(0_0_0/0.55)]">
      <div className="flex h-10 items-center gap-1.5 border-b border-border bg-surface-2 px-4" aria-hidden>
        <span className="size-2.5 rounded-full bg-surface-3" /><span className="size-2.5 rounded-full bg-surface-3" /><span className="size-2.5 rounded-full bg-surface-3" />
        <span className="mx-auto hidden rounded-md bg-surface px-3 py-0.5 text-[11px] text-muted sm:block">admin · {sample.store}</span>
      </div>
      <div className="grid min-h-[520px] grid-cols-1 md:grid-cols-[190px_1fr]">
        <nav className="flex gap-1 overflow-x-auto border-b border-border bg-surface-2 p-2 md:flex-col md:border-b-0 md:border-r" aria-label="Demo">
          {(Object.keys(ICONS) as Tab[]).map((k) => {
            const Icon = ICONS[k];
            return (
              <button key={k} type="button" onClick={() => setTab(k)} aria-current={tab === k}
                className={cn("relative flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors", tab === k ? "text-text" : "text-muted hover:text-text")}>
                {tab === k && <motion.span layoutId="demo-tab" className="absolute inset-0 rounded-lg bg-surface shadow-sm" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                <Icon className="relative size-4" aria-hidden /><span className="relative">{d.nav[k]}</span>
              </button>
            );
          })}
        </nav>
        <div className="relative min-w-0 p-4 sm:p-6">
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 10, filter: "blur(3px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.28, ease }}>
              {tab === "home" && <HomePanel d={d} />}
              {tab === "orders" && <OrdersPanel d={d} sample={sample} />}
              {tab === "products" && <ProductsPanel d={d} sample={sample} />}
              {tab === "design" && <DesignPanel d={d} sample={sample} />}
              {tab === "assistant" && <AssistantPanel d={d} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function Count({ to, prefix = "", suffix = "", decimals = 0 }: { to: number; prefix?: string; suffix?: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!inView || !ref.current) return;
    const set = (v: number) => { if (ref.current) ref.current.textContent = `${prefix}${v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`; };
    if (reduce) return set(to);
    const c = animate(0, to, { duration: 1.2, ease, onUpdate: set });
    return () => c.stop();
  }, [inView, to, prefix, suffix, decimals, reduce]);
  return <span ref={ref}>{prefix}0{suffix}</span>;
}

const BARS = [28, 40, 34, 52, 46, 61, 55, 49, 66, 72, 64, 81, 77, 92];

function HomePanel({ d }: { d: MarketingCopy["demo"] }) {
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        {[{ l: d.kpis.sales, n: <Count to={12480} prefix="€" /> }, { l: d.kpis.orders, n: <Count to={318} /> }, { l: d.kpis.conversion, n: <Count to={3.4} decimals={1} suffix="%" /> }].map((k) => (
          <div key={k.l} className="rounded-xl border border-border p-3 sm:p-4"><p className="text-[11px] text-muted">{k.l}</p><p className="mt-1 text-lg font-semibold tabular-nums sm:text-2xl">{k.n}</p></div>
        ))}
      </div>
      <div className="mt-4 rounded-xl border border-border p-4">
        <p className="mb-3 text-xs text-muted">{d.chart}</p>
        <div className="flex h-56 items-end gap-1.5" onMouseLeave={() => setHover(null)}>
          {BARS.map((h, i) => (
            <div key={i} className="relative flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)}>
              <motion.span className="w-full rounded-t-[5px] bg-accent" initial={{ height: 0 }} animate={{ height: `${h}%`, opacity: hover === null || hover === i ? 1 : 0.35 }} transition={{ duration: 0.8, ease, delay: hover === null ? i * 0.035 : 0 }} />
              <AnimatePresence>
                {hover === i && <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-text px-1.5 py-0.5 text-[10px] font-medium text-bg">€{(h * 13.6).toFixed(0)}</motion.span>}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OrdersPanel({ d, sample }: { d: MarketingCopy["demo"]; sample: (typeof SAMPLE)["it"] }) {
  const [shipped, setShipped] = useState<number[]>([3, 4]);
  return (
    <div>
      <p className="mb-3 text-sm font-semibold">{d.ordersTitle}</p>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
        {sample.names.map((n, i) => {
          const done = shipped.includes(i);
          return (
            <li key={n} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <span className="font-medium tabular-nums">#{1048 - i}</span>
              <span className="text-muted">{n}</span>
              <span className="tabular-nums">€{(38 + i * 17.5).toFixed(2)}</span>
              <motion.span layout className={cn("ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium", done ? "bg-success-bg text-success" : "bg-warning-bg text-warning")}>{done ? d.shipped : d.unfulfilled}</motion.span>
              {!done && (
                <motion.button type="button" whileTap={{ scale: 0.95 }} onClick={() => setShipped((s) => [...s, i])} className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-surface-2">{d.fulfil}</motion.button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ProductsPanel({ d, sample }: { d: MarketingCopy["demo"]; sample: (typeof SAMPLE)["it"] }) {
  const [active, setActive] = useState<boolean[]>(sample.products.map((_, i) => i !== 3));
  return (
    <div>
      <p className="mb-3 text-sm font-semibold">{d.productsTitle}</p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {sample.products.map((p, i) => (
          <motion.li key={p} layout className="rounded-xl border border-border p-3">
            <div className="aspect-[4/3] rounded-lg" style={{ background: `linear-gradient(135deg, hsl(${30 + i * 40} 30% 82%), hsl(${30 + i * 40} 25% 70%))` }} />
            <p className="mt-2 truncate text-sm font-medium">{p}</p>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-xs tabular-nums text-muted">€{(14.9 + i * 6).toFixed(2)}</span>
              <button type="button" role="switch" aria-checked={active[i]} aria-label={p} onClick={() => setActive((a) => a.map((x, n) => (n === i ? !x : x)))}
                className={cn("flex h-5 w-9 items-center rounded-full px-0.5 transition-colors", active[i] ? "bg-success" : "bg-surface-3")}>
                <motion.span layout transition={{ type: "spring", stiffness: 600, damping: 35 }} className={cn("size-4 rounded-full bg-white shadow", active[i] && "ml-auto")} />
              </button>
            </div>
            <p className={cn("mt-1 text-[11px]", active[i] ? "text-success" : "text-muted")}>{active[i] ? d.active : d.draft}</p>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

function DesignPanel({ d, sample }: { d: MarketingCopy["demo"]; sample: (typeof SAMPLE)["it"] }) {
  const presets = THEME_PRESETS.slice(0, 8);
  const [p, setP] = useState(presets[2]);
  const radius = p.buttonShape === "pill" ? 999 : p.buttonShape === "rounded" ? 8 : 0;
  return (
    <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
      <div>
        <p className="text-sm font-semibold">{d.designTitle}</p>
        <p className="mb-3 mt-0.5 text-xs text-muted">{d.designHint}</p>
        <ul className="grid grid-cols-4 gap-2 lg:grid-cols-2">
          {presets.map((x) => (
            <li key={x.id}>
              <button type="button" onClick={() => setP(x)} aria-pressed={p.id === x.id} className={cn("w-full overflow-hidden rounded-lg border text-left transition-transform hover:-translate-y-0.5", p.id === x.id ? "border-text ring-1 ring-text" : "border-border")}>
                <span className="block h-8" style={{ background: x.backgroundColor }}><span className="ml-2 mt-2 inline-block h-3 w-6" style={{ background: x.primaryColor, borderRadius: x.buttonShape === "pill" ? 99 : 3 }} /></span>
                <span className="block truncate bg-surface px-1.5 py-1 text-[10px] font-medium">{x.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <motion.div animate={{ backgroundColor: p.backgroundColor, color: p.textColor }} transition={{ duration: 0.5 }} className="overflow-hidden rounded-xl border border-border">
        <div className="flex items-center justify-between border-b px-4 py-3 text-sm font-semibold" style={{ borderColor: `${p.textColor}22` }}>{sample.store}<span className="text-xs opacity-60">☰</span></div>
        <div className="px-6 py-12">
          <AnimatePresence mode="wait">
            <motion.div key={p.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.4, ease }}>
              <p className="text-3xl font-semibold tracking-tight" style={{ fontFamily: p.headingFont === "playfair" || p.font === "playfair" ? "Georgia, serif" : p.font === "lora" || p.headingFont === "lora" ? "Georgia, serif" : undefined }}>{sample.tagline}</p>
              <motion.span animate={{ backgroundColor: p.primaryColor, color: contrastText(p.primaryColor), borderRadius: radius }} className="mt-5 inline-block px-5 py-2 text-sm font-medium">{d.shopNow}</motion.span>
            </motion.div>
          </AnimatePresence>
          <div className="mt-8 grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => <motion.div key={i} animate={{ backgroundColor: `${p.textColor}12` }} className="aspect-square" style={{ borderRadius: p.cornerStyle === "round" ? 16 : p.cornerStyle === "soft" ? 8 : 0 }} />)}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function AssistantPanel({ d }: { d: MarketingCopy["demo"] }) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const send = () => {
    if (step) return;
    setStep(1);
    setTimeout(() => setStep(2), 1600);
  };
  return (
    <div className="mx-auto flex h-[440px] max-w-xl flex-col rounded-xl border border-border">
      <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
        <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-[85%] rounded-2xl rounded-bl-md bg-surface-2 px-3.5 py-2">{d.assistantHello}</motion.p>
        {step >= 1 && <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-text px-3.5 py-2 text-bg">{d.assistantPrompt}</motion.p>}
        {step === 1 && (
          <div className="flex gap-1.5 px-1 py-2" aria-hidden>{[0, 1, 2].map((i) => <motion.span key={i} className="size-1.5 rounded-full bg-muted" animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }} />)}</div>
        )}
        {step === 2 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-[90%]">
            <p className="rounded-2xl rounded-bl-md bg-surface-2 px-3.5 py-2">{d.assistantReply}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {d.assistantChips.map((c, i) => <motion.span key={c} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 + i * 0.1 }} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium"><Check className="size-3" />{c}</motion.span>)}
            </div>
          </motion.div>
        )}
      </div>
      <div className="border-t border-border p-2.5">
        <div className="flex items-center gap-2 rounded-xl border border-border px-3 py-2">
          <span className={cn("flex-1 truncate text-sm", step ? "text-muted" : "")}>{step ? "…" : d.assistantPrompt}</span>
          <motion.button type="button" onClick={send} disabled={!!step} whileTap={{ scale: 0.9 }} aria-label={d.send} className="flex size-8 items-center justify-center rounded-full bg-text text-bg disabled:opacity-30"><ArrowUp className="size-4" /></motion.button>
        </div>
      </div>
    </div>
  );
}
