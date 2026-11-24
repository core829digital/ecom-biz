"use client";

import Link from "next/link";
import { useRef, type ReactNode } from "react";
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/cn";

export const ease = [0.22, 1, 0.36, 1] as const;
const spring = { type: "spring", stiffness: 420, damping: 28, mass: 0.7 } as const;

/**
 * Large pill call-to-action. On hover it lifts, a light sheen sweeps across and the arrow
 * slides out while a twin slides in (Discord-style); on press it compresses slightly.
 */
export function PillButton({ href, children, variant = "solid", size = "lg", arrow = true, className }: {
  href: string; children: ReactNode; variant?: "solid" | "ghost" | "inverse"; size?: "md" | "lg"; arrow?: boolean; className?: string;
}) {
  const reduce = useReducedMotion();
  const styles = {
    solid: "bg-text text-bg shadow-[0_1px_0_rgb(255_255_255/0.12)_inset,0_10px_30px_-10px_rgb(0_0_0/0.5)]",
    inverse: "bg-bg text-text shadow-[0_10px_30px_-10px_rgb(0_0_0/0.45)]",
    ghost: "border border-border bg-surface/60 text-text backdrop-blur hover:border-text/40",
  }[variant];
  return (
    <motion.span className="inline-flex" whileHover={reduce ? undefined : { y: -3 }} whileTap={reduce ? undefined : { scale: 0.97, y: 0 }} transition={spring}>
      <Link href={href}
        className={cn("group relative inline-flex items-center gap-2.5 overflow-hidden rounded-full font-medium transition-[box-shadow,border-color] duration-300",
          size === "lg" ? "h-14 px-8 text-base" : "h-11 px-6 text-sm", styles,
          variant !== "ghost" && "hover:shadow-[0_1px_0_rgb(255_255_255/0.12)_inset,0_18px_40px_-12px_rgb(0_0_0/0.55)]", className)}>
        {variant !== "ghost" && (
          <span className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 transition-[left,opacity] duration-700 ease-out group-hover:left-[130%] group-hover:opacity-100" aria-hidden />
        )}
        <span className="relative">{children}</span>
        {arrow && (
          <span className="relative flex size-4 overflow-hidden" aria-hidden>
            <Arrow className="absolute inset-0 transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] group-hover:translate-x-[140%]" />
            <Arrow className="absolute inset-0 -translate-x-[140%] transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] group-hover:translate-x-0" />
          </span>
        )}
      </Link>
    </motion.span>
  );
}

function Arrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2.5 8h11M9 3.5 13.5 8 9 12.5" />
    </svg>
  );
}

/** Plus that becomes a minus: the vertical bar rotates flat and fades into the horizontal one. */
export function MorphPlus({ open, className }: { open: boolean; className?: string }) {
  return (
    <motion.span className={cn("relative block size-4", className)} animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.45, ease }} aria-hidden>
      <span className="absolute inset-x-0 top-1/2 h-[1.75px] -translate-y-1/2 rounded-full bg-current" />
      <motion.span className="absolute inset-y-0 left-1/2 w-[1.75px] -translate-x-1/2 rounded-full bg-current" animate={{ scaleY: open ? 0 : 1, rotate: open ? 90 : 0 }} transition={{ duration: 0.45, ease }} />
    </motion.span>
  );
}

/** Hamburger whose lines rotate into a cross. */
export function MorphMenu({ open }: { open: boolean }) {
  const line = "absolute left-0 h-[1.75px] w-full rounded-full bg-current";
  return (
    <span className="relative block h-3.5 w-5" aria-hidden>
      <motion.span className={line} style={{ top: 0 }} animate={open ? { top: "50%", rotate: 45, y: "-50%" } : { top: 0, rotate: 0, y: 0 }} transition={{ duration: 0.4, ease }} />
      <motion.span className={line} style={{ top: "50%", y: "-50%" }} animate={{ opacity: open ? 0 : 1, scaleX: open ? 0.2 : 1 }} transition={{ duration: 0.25 }} />
      <motion.span className={line} style={{ bottom: 0 }} animate={open ? { bottom: "50%", rotate: -45, y: "50%" } : { bottom: 0, rotate: 0, y: 0 }} transition={{ duration: 0.4, ease }} />
    </span>
  );
}

/** Heading whose words rise out of a mask, one after another, when scrolled into view. */
export function MaskReveal({ text, as: Tag = "h2", className, delay = 0, immediate }: { text: string; as?: "h1" | "h2" | "p"; className?: string; delay?: number; immediate?: boolean }) {
  const reduce = useReducedMotion();
  const words = text.split(" ");
  const anim = (i: number) => ({
    initial: reduce ? { opacity: 0 } : { y: "110%", rotate: 4 },
    ...(immediate ? { animate: { y: "0%", rotate: 0, opacity: 1 } } : { whileInView: { y: "0%", rotate: 0, opacity: 1 }, viewport: { once: true, margin: "-60px" } }),
    transition: { duration: 0.9, ease, delay: delay + i * 0.06 },
  });
  return (
    <Tag className={className} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.12em] align-bottom" aria-hidden>
          <motion.span className="inline-block origin-bottom-left pr-[0.24em]" {...anim(i)}>{w}</motion.span>
        </span>
      ))}
    </Tag>
  );
}

/** Card that tilts toward the cursor with a soft light following it. */
export function TiltCard({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rx = useSpring(useTransform(py, [0, 1], [5, -5]), { stiffness: 200, damping: 20 });
  const ry = useSpring(useTransform(px, [0, 1], [-6, 6]), { stiffness: 200, damping: 20 });
  const lx = useTransform(px, (v) => `${v * 100}%`);
  const ly = useTransform(py, (v) => `${v * 100}%`);
  const light = useMotionTemplate`radial-gradient(420px circle at ${lx} ${ly}, color-mix(in srgb, var(--text) 7%, transparent), transparent 60%)`;
  return (
    <motion.div ref={ref} className={cn("group relative [transform-style:preserve-3d]", className)}
      style={reduce ? undefined : { rotateX: rx, rotateY: ry, transformPerspective: 1200 }}
      onMouseMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        px.set((e.clientX - r.left) / r.width);
        py.set((e.clientY - r.top) / r.height);
      }}
      onMouseLeave={() => { px.set(0.5); py.set(0.5); }}>
      <motion.div className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: light }} aria-hidden />
      {children}
    </motion.div>
  );
}

/** Thin bar at the top of the page showing reading progress. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });
  return <motion.div className="fixed inset-x-0 top-0 z-[60] h-[2px] origin-left bg-text" style={{ scaleX }} aria-hidden />;
}
