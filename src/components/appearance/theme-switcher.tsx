"use client";

import { useTransition } from "react";
import { motion } from "framer-motion";
import { Monitor, Moon, Sun } from "lucide-react";
import { ACCENTS, ACCENT_SWATCH, type AccentPref, type ThemePref } from "@/lib/appearance";
import { cn } from "@/lib/cn";
import { setAppearanceAction } from "./actions";

function setAttributes(theme: ThemePref, accent: AccentPref) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  if (accent === "neutral") root.removeAttribute("data-accent");
  else root.setAttribute("data-accent", accent);
}

type ViewTransitionDoc = Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> } };

/**
 * Apply instantly on <html>, then persist in the background. With an origin (the click point)
 * and a browser that supports View Transitions, the new theme spreads as a circle from there;
 * otherwise (or with reduced motion) it cross-fades.
 */
export function applyAppearance(theme: ThemePref, accent: AccentPref, origin?: { x: number; y: number }) {
  const root = document.documentElement;
  const doc = document as ViewTransitionDoc;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (origin && doc.startViewTransition && !reduce) {
    const { x, y } = origin;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.classList.add("theme-wave");
    const vt = doc.startViewTransition(() => setAttributes(theme, accent));
    vt.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 620, easing: "cubic-bezier(0.22, 1, 0.36, 1)", pseudoElement: "::view-transition-new(root)" },
      );
    }).catch(() => undefined);
    vt.finished.finally(() => root.classList.remove("theme-wave"));
    return;
  }
  root.classList.add("theme-transition");
  setAttributes(theme, accent);
  window.setTimeout(() => root.classList.remove("theme-transition"), 260);
}

/** Center of the clicked control (keyboard activation has no pointer coordinates). */
function originOf(e: React.MouseEvent<HTMLElement>) {
  if (e.clientX || e.clientY) return { x: e.clientX, y: e.clientY };
  const r = e.currentTarget.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function currentFromDom(): { theme: ThemePref; accent: AccentPref } {
  const root = document.documentElement;
  return {
    theme: (root.getAttribute("data-theme") as ThemePref) ?? "system",
    accent: (root.getAttribute("data-accent") as AccentPref) ?? "neutral",
  };
}

export function ThemeSwitcher({
  theme,
  onChange,
  labels,
  layoutId = "theme-pill",
  compact,
}: {
  theme: ThemePref;
  onChange: (t: ThemePref) => void;
  labels: Record<ThemePref, string>;
  layoutId?: string;
  compact?: boolean;
}) {
  const [, start] = useTransition();
  const items: { value: ThemePref; icon: typeof Sun }[] = [
    { value: "light", icon: Sun },
    { value: "dark", icon: Moon },
    { value: "system", icon: Monitor },
  ];
  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5">
      {items.map(({ value, icon: Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            title={labels[value]}
            onClick={(e) => {
              const { accent } = currentFromDom();
              applyAppearance(value, accent, originOf(e));
              onChange(value);
              start(() => setAppearanceAction(value, accent));
            }}
            className={cn("relative flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors", active ? "text-text" : "text-muted hover:text-text")}
          >
            {active && <motion.span layoutId={layoutId} className="absolute inset-0 rounded-md bg-surface shadow-soft" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            <Icon className="relative size-3.5" aria-hidden />
            {!compact && <span className="relative">{labels[value]}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function AccentPicker({ accent, onChange, labels }: { accent: AccentPref; onChange: (a: AccentPref) => void; labels: Record<AccentPref, string> }) {
  const [, start] = useTransition();
  return (
    <div role="radiogroup" aria-label="Accent color" className="flex flex-wrap gap-2">
      {ACCENTS.map((a) => (
        <button
          key={a}
          type="button"
          role="radio"
          aria-checked={accent === a}
          title={labels[a]}
          onClick={(e) => {
            const { theme } = currentFromDom();
            applyAppearance(theme, a, originOf(e));
            onChange(a);
            start(() => setAppearanceAction(theme, a));
          }}
          className={cn("relative size-8 rounded-full ring-offset-2 ring-offset-surface transition-transform hover:scale-110", accent === a && "ring-2 ring-text")}
          style={{ background: a === "neutral" ? "linear-gradient(135deg,#18181b 50%,#fafafa 50%)" : ACCENT_SWATCH[a] }}
        >
          <span className="sr-only">{labels[a]}</span>
        </button>
      ))}
    </div>
  );
}
