"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence, animate, motion, useInView, useMotionTemplate, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform,
} from "framer-motion";
import { BarChart3, Boxes, Check, ChevronDown, Home, Package, ShoppingBag, Users } from "lucide-react";
import { MaskReveal, MorphMenu, PillButton } from "./motion-ui";
import type { LandingCopy } from "@/lib/i18n/landing";
import type { ThemePref } from "@/lib/appearance";
import { ThemeSwitcher } from "@/components/appearance/theme-switcher";
import { cn } from "@/lib/cn";

export const ease = [0.22, 1, 0.36, 1] as const;

export function LandingNav({ copy, brand, loggedIn, theme, themeLabels, locale, onLocale }: {
  copy: LandingCopy; brand: string; loggedIn: boolean; theme: ThemePref; themeLabels: Record<ThemePref, string>; locale: string; onLocale: (l: "en" | "it") => void;
}) {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [th, setTh] = useState(theme);
  const [hover, setHover] = useState<string | null>(null);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 12));
  const links: [string, string][] = [["#features", copy.nav.features], ["#how", copy.nav.how], ["#pricing", copy.nav.pricing], ["#faq", copy.nav.faq]];
  return (
    <motion.header
      className={cn("fixed inset-x-0 top-0 z-50 transition-[background,border-color,backdrop-filter] duration-300", scrolled ? "border-b border-border bg-bg/75 backdrop-blur-xl" : "border-b border-transparent")}
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease }}
    >
      <nav className="mx-auto flex h-[72px] max-w-7xl items-center gap-6 px-4 sm:px-6" aria-label="Main">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-lg bg-text text-xs font-bold text-bg">{brand.slice(0, 1).toUpperCase()}</span>
          {brand}
        </Link>
        <ul className="hidden items-center text-sm text-muted md:flex" onMouseLeave={() => setHover(null)}>
          {links.map(([href, label]) => (
            <li key={href} className="relative">
              {hover === href && <motion.span layoutId="nav-hover" className="absolute inset-0 rounded-full bg-surface-2" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
              <a href={href} onMouseEnter={() => setHover(href)} className="relative block rounded-full px-3.5 py-2 transition-colors hover:text-text">{label}</a>
            </li>
          ))}
        </ul>
        <div className="ml-auto hidden items-center gap-3 md:flex">
          <div className="flex rounded-lg border border-border p-0.5 text-xs" role="group" aria-label={copy.footer.language}>
            {(["en", "it"] as const).map((l) => (
              <button key={l} onClick={() => onLocale(l)} aria-pressed={locale === l} className={cn("rounded-md px-2 py-1 font-medium uppercase", locale === l ? "bg-surface-2 text-text" : "text-muted hover:text-text")}>{l}</button>
            ))}
          </div>
          <ThemeSwitcher theme={th} onChange={setTh} labels={themeLabels} compact layoutId="landing-theme" />
          {loggedIn ? (
            <PillButton href="/admin" size="md" className="h-10 px-5">{copy.nav.dashboard}</PillButton>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-muted hover:text-text">{copy.nav.login}</Link>
              <PillButton href="/signup" size="md" className="h-10 px-5">{copy.nav.start}</PillButton>
            </>
          )}
        </div>
        <button className="ml-auto flex size-10 items-center justify-center rounded-full transition-colors hover:bg-surface-2 md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}><MorphMenu open={open} /></button>
      </nav>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-border bg-bg md:hidden">
            <ul className="space-y-1 px-4 py-4">
              {links.map(([href, label]) => <li key={href}><a href={href} onClick={() => setOpen(false)} className="block rounded-md px-2 py-2 hover:bg-surface-2">{label}</a></li>)}
              <li className="flex items-center gap-3 px-2 pt-2">
                <ThemeSwitcher theme={th} onChange={setTh} labels={themeLabels} compact layoutId="landing-theme-m" />
                {(["en", "it"] as const).map((l) => <button key={l} onClick={() => onLocale(l)} className={cn("text-sm uppercase", locale === l ? "font-semibold" : "text-muted")}>{l}</button>)}
              </li>
              <li className="grid grid-cols-2 gap-2 pt-3">
                <Link href={loggedIn ? "/admin" : "/login"} className="flex h-11 items-center justify-center rounded-full border border-border text-sm font-medium">{loggedIn ? copy.nav.dashboard : copy.nav.login}</Link>
                <Link href="/signup" className="flex h-11 items-center justify-center rounded-full bg-text text-sm font-medium text-bg">{copy.nav.start}</Link>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

/** Button/link that leans toward the cursor. */
export function MagneticLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const reduce = useReducedMotion();
  const x = useSpring(0, { stiffness: 300, damping: 20 });
  const y = useSpring(0, { stiffness: 300, damping: 20 });
  return (
    <motion.span style={{ x, y, display: "inline-flex" }}>
      <Link
        ref={ref}
        href={href}
        className={className}
        onMouseMove={(e) => {
          if (reduce || !ref.current) return;
          const r = ref.current.getBoundingClientRect();
          x.set((e.clientX - r.left - r.width / 2) * 0.25);
          y.set((e.clientY - r.top - r.height / 2) * 0.35);
        }}
        onMouseLeave={() => { x.set(0); y.set(0); }}
      >
        {children}
      </Link>
    </motion.span>
  );
}

export function Hero({ copy }: { copy: LandingCopy }) {
  const reduce = useReducedMotion();
  const section = useRef<HTMLElement>(null);
  const mx = useMotionValue(50);
  const my = useMotionValue(30);
  const spotlight = useMotionTemplate`radial-gradient(600px circle at ${mx}% ${my}%, color-mix(in srgb, var(--accent) 12%, transparent), transparent 70%)`;
  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end start"] });
  const rotateX = useTransform(scrollYProgress, [0, 0.6], reduce ? [0, 0] : [22, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.6], reduce ? [1, 1] : [0.92, 1]);
  const lift = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, -80]);

  return (
    <section
      ref={section}
      className="relative overflow-hidden pb-28 pt-36 sm:pt-48"
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set(((e.clientX - r.left) / r.width) * 100);
        my.set(((e.clientY - r.top) / r.height) * 100);
      }}
    >
      {/* Grid + spotlight background */}
      <div className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_50%_0%,black_30%,transparent_75%)] opacity-60" aria-hidden />
      <motion.div className="pointer-events-none absolute inset-0" style={{ background: spotlight }} aria-hidden />

      <div className="relative mx-auto max-w-7xl px-4 text-center sm:px-6">
        <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease, delay: 0.1 }}
          className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1 text-xs font-medium text-muted shadow-soft backdrop-blur">
          <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-success" /></span>
          {copy.hero.eyebrow}
        </motion.p>
        <MaskReveal as="h1" immediate delay={0.15} text={copy.hero.title}
          className="mx-auto mt-8 max-w-5xl text-balance text-[clamp(2.75rem,8vw,6.25rem)] font-semibold leading-[0.98] tracking-[-0.045em]" />
        <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease, delay: 0.5 }}
          className="mx-auto mt-8 max-w-2xl text-pretty text-lg text-muted sm:text-xl">{copy.hero.subtitle}</motion.p>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease, delay: 0.62 }}
          className="mt-11 flex flex-wrap items-center justify-center gap-3">
          <PillButton href="/signup">{copy.hero.primary}</PillButton>
          <PillButton href="#how" variant="ghost" arrow={false}>{copy.hero.secondary}</PillButton>
        </motion.div>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9, duration: 0.6 }} className="mt-5 text-xs text-muted">{copy.hero.note}</motion.p>
        <motion.a href="#features" aria-label={copy.nav.features} initial={{ opacity: 0 }} animate={{ opacity: 1, y: [0, 6, 0] }} transition={{ opacity: { delay: 1.4 }, y: { delay: 1.4, duration: 2.2, repeat: Infinity, ease: "easeInOut" } }}
          className="mx-auto mt-8 hidden size-9 items-center justify-center rounded-full border border-border text-muted hover:text-text sm:flex">
          <ChevronDown className="size-4" aria-hidden />
        </motion.a>
      </div>

      <motion.div className="relative mx-auto mt-20 max-w-6xl px-4 sm:px-6 [perspective:1600px]" style={{ y: lift }}
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease, delay: 0.55 }}>
        <motion.div style={{ rotateX, scale, transformOrigin: "50% 0%" }} className="will-change-transform">
          <DashboardMock toastLabel={copy.hero.toast} labels={copy.mock} />
        </motion.div>
        <div className="pointer-events-none absolute inset-x-0 -bottom-10 h-40 bg-gradient-to-t from-bg to-transparent" aria-hidden />
      </motion.div>
    </section>
  );
}

function CountUp({ to, prefix = "", decimals = 0 }: { to: number; prefix?: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!inView || !ref.current) return;
    if (reduce) { ref.current.textContent = prefix + to.toFixed(decimals); return; }
    const c = animate(0, to, { duration: 1.6, ease, onUpdate: (v) => { if (ref.current) ref.current.textContent = prefix + v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }); } });
    return () => c.stop();
  }, [inView, to, prefix, decimals, reduce]);
  return <span ref={ref}>{prefix}0</span>;
}

const BARS = [32, 45, 38, 52, 48, 61, 55, 70, 64, 78, 72, 88, 81, 95];
const ORDERS = [
  { n: 1043, who: "Ana P.", total: "€58.20" },
  { n: 1044, who: "Marco R.", total: "€124.00" },
  { n: 1045, who: "Elena V.", total: "€39.90" },
  { n: 1046, who: "Luca B.", total: "€212.50" },
];

/** Live-feeling admin preview, built from real UI primitives (no screenshots). */
function DashboardMock({ toastLabel, labels }: { toastLabel: string; labels: LandingCopy["mock"] }) {
  const reduce = useReducedMotion();
  const [toast, setToast] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setToast((t) => t + 1), 2800);
    return () => window.clearInterval(id);
  }, [reduce]);
  const order = ORDERS[toast % ORDERS.length];
  const nav = [Home, ShoppingBag, Package, Boxes, Users, BarChart3];
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_40px_120px_-40px_hsl(var(--shadow-color)/0.45)]">
      <div className="flex h-9 items-center gap-1.5 border-b border-border bg-surface-2 px-4" aria-hidden>
        <span className="size-2.5 rounded-full bg-surface-3" /><span className="size-2.5 rounded-full bg-surface-3" /><span className="size-2.5 rounded-full bg-surface-3" />
      </div>
      <div className="grid grid-cols-[44px_1fr] sm:grid-cols-[56px_160px_1fr]" aria-hidden>
        <div className="flex flex-col items-center gap-2 border-r border-border bg-surface-2 py-3">
          {["AD", "NB", "+"].map((s, i) => (
            <span key={s} className={cn("flex size-8 items-center justify-center text-[10px] font-semibold", i === 0 ? "rounded-xl bg-text text-bg" : "rounded-full bg-surface text-muted")}>{s}</span>
          ))}
        </div>
        <div className="hidden space-y-1 border-r border-border p-3 sm:block">
          {nav.map((Icon, i) => (
            <div key={i} className={cn("flex items-center gap-2 rounded-md px-2 py-1.5", i === 0 && "bg-surface-3/70")}>
              <Icon className="size-3.5 text-muted" />
              <span className="h-1.5 rounded-full bg-surface-3" style={{ width: 40 + ((i * 17) % 40) }} />
            </div>
          ))}
        </div>
        <div className="relative p-4 sm:p-5">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: labels.sales, node: <CountUp to={48250} prefix="€" /> },
              { label: labels.orders, node: <CountUp to={1284} /> },
              { label: labels.conversion, node: <><CountUp to={3.8} decimals={1} />%</> },
            ].map((k) => (
              <div key={k.label} className="rounded-xl border border-border p-3">
                <p className="text-[10px] text-muted">{k.label}</p>
                <p className="mt-1 text-base font-semibold tabular-nums sm:text-xl">{k.node}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl border border-border p-3">
            <div className="flex h-28 items-end gap-1.5 sm:h-36">
              {BARS.map((h, i) => (
                <motion.span key={i} className="flex-1 rounded-t-[4px] bg-accent"
                  initial={{ height: 0 }} whileInView={{ height: `${h}%` }} viewport={{ once: true }}
                  transition={{ duration: reduce ? 0 : 0.9, ease, delay: reduce ? 0 : 0.6 + i * 0.04 }}
                  style={{ opacity: 0.35 + (i / BARS.length) * 0.65 }} />
              ))}
            </div>
          </div>
          <AnimatePresence mode="popLayout">
            <motion.div key={toast}
              initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              className="absolute bottom-5 right-5 flex items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-left shadow-elevated">
              <span className="flex size-7 items-center justify-center rounded-full bg-success-bg text-success"><Check className="size-4" /></span>
              <span>
                <span className="block text-xs font-semibold">{toastLabel} #{order.n}</span>
                <span className="block text-[11px] text-muted">{order.who} · {order.total}</span>
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
